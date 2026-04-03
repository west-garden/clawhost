# Skill and Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Skill import/creation and Cron task management to ClawHost Portal

**Architecture:** Backend handlers call k8s service functions that use kubectl exec to interact with OpenClaw Pod. Skills are downloaded from GitHub API and written to Pod filesystem. Cron tasks are managed via `openclaw cron` CLI commands.

**Tech Stack:** Go/Echo (Backend), Next.js (Portal), GitHub API, kubectl exec

---

## File Structure

### Backend New Files
- `service/github/fetcher.go` — GitHub API client for fetching SKILL.md
- `handler/api/v1/agent_skill_install.go` — Install and Create skill handlers
- `handler/api/v1/agent_cron.go` — Cron management handlers
- `service/k8s/cron.go` — Cron CLI execution functions

### Backend Modified Files
- `cmd/server.go` — Add new routes

### Frontend New Files
- `src/components/skill-install-dialog.tsx` — GitHub install dialog
- `src/components/skill-create-dialog.tsx` — Create skill dialog
- `src/app/(dashboard)/agents/[id]/tasks/page.tsx` — Tasks page
- `src/components/task-list.tsx` — Task list component

### Frontend Modified Files
- `src/app/(dashboard)/agents/[id]/skills/page.tsx` — Add install/create buttons
- `src/lib/actions.ts` — Add new API functions
- `src/messages/zh.json` — Add i18n
- `src/messages/en.json` — Add i18n
- `src/components/agent-detail-header.tsx` — Add Tasks nav

---

## Task 1: GitHub Skill Fetcher Service

**Files:**
- Create: `service/github/fetcher.go`

- [ ] **Step 1: Create the github service directory and fetcher file**

```go
// service/github/fetcher.go
package github

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

const maxSkillSize = 100 * 1024 // 100KB

// SkillContent represents a fetched skill
type SkillContent struct {
	Name    string
	Content string
}

// Fetcher handles fetching skills from GitHub
type Fetcher struct {
	Token string // Optional GitHub token for higher rate limits
}

// NewFetcher creates a new GitHub fetcher
func NewFetcher(token string) *Fetcher {
	return &Fetcher{Token: token}
}

// ParseGitHubURL parses various GitHub URL formats and returns owner, repo, skill name
// Supported formats:
// - owner/repo@skill-name
// - https://github.com/owner/repo/tree/branch/skills/skill-name
// - https://github.com/owner/repo/tree/branch/skills/skill-name/SKILL.md
// - https://raw.githubusercontent.com/owner/repo/branch/skills/skill-name/SKILL.md
func (f *Fetcher) ParseGitHubURL(input string) (owner, repo, skillName string, err error) {
	// Format: owner/repo@skill-name
	if specPattern := regexp.MustCompile(`^([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)@([a-zA-Z0-9_-]+)$`); specPattern.MatchString(input) {
		matches := specPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://github.com/owner/repo/tree/branch/skills/skill-name
	treePattern := regexp.MustCompile(`^https://github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/tree/[^/]+/skills/([a-zA-Z0-9_-]+)(?:/SKILL\.md)?/?$`)
	if treePattern.MatchString(input) {
		matches := treePattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://raw.githubusercontent.com/owner/repo/branch/skills/skill-name/SKILL.md
	rawPattern := regexp.MustCompile(`^https://raw\.githubusercontent\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/[^/]+/skills/([a-zA-Z0-9_-]+)/SKILL\.md$`)
	if rawPattern.MatchString(input) {
		matches := rawPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://github.com/owner/repo (default to skills/SKILL.md)
	simplePattern := regexp.MustCompile(`^https://github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/?$`)
	if simplePattern.MatchString(input) {
		matches := simplePattern.FindStringSubmatch(input)
		return matches[1], matches[2], "", nil // Empty skill name means default
	}

	return "", "", "", fmt.Errorf("invalid GitHub URL or spec format: %s", input)
}

// FetchSkill fetches a skill from GitHub
func (f *Fetcher) FetchSkill(owner, repo, skillName string) (*SkillContent, error) {
	client := &http.Client{}

	// Build API URL for the skill file
	// Try skills/{skillName}/SKILL.md first, then skills/SKILL.md
	var apiURL string
	if skillName != "" {
		apiURL = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/skills/%s/SKILL.md", owner, repo, skillName)
	} else {
		apiURL = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/skills/SKILL.md", owner, repo)
	}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	if f.Token != "" {
		req.Header.Set("Authorization", "Bearer "+f.Token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("skill not found in repository %s/%s", owner, repo)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API error: %s", resp.Status)
	}

	// Parse JSON response
	var result struct {
		Name    string `json:"name"`
		Content string `json:"content"`
		Size    int    `json:"size"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse GitHub response: %w", err)
	}

	// Check size
	if result.Size > maxSkillSize {
		return nil, fmt.Errorf("skill file too large: %d bytes (max %d)", result.Size, maxSkillSize)
	}

	// Decode base64 content
	content, err := base64.StdEncoding.DecodeString(result.Content)
	if err != nil {
		return nil, fmt.Errorf("failed to decode content: %w", err)
	}

	// Validate YAML frontmatter
	contentStr := string(content)
	if !strings.HasPrefix(strings.TrimSpace(contentStr), "---") {
		return nil, fmt.Errorf("skill must have YAML frontmatter (start with ---)")
	}

	// Extract skill name from content or use provided name
	finalName := skillName
	if finalName == "" {
		// Try to extract from frontmatter
		namePattern := regexp.MustCompile(`(?m)^name:\s*(.+)$`)
		if matches := namePattern.FindStringSubmatch(contentStr); len(matches) > 1 {
			finalName = strings.TrimSpace(matches[1])
		} else {
			finalName = "imported-skill"
		}
	}

	// Validate name format
	if !regexp.MustCompile(`^[a-z0-9_-]+$`).MatchString(finalName) {
		return nil, fmt.Errorf("skill name must be lowercase letters, numbers, hyphens and underscores only")
	}

	return &SkillContent{
		Name:    finalName,
		Content: contentStr,
	}, nil
}

// Import needed for JSON
import "encoding/json"
```

Wait, the import should be at the top. Let me rewrite properly:

- [ ] **Step 1: Create the github service directory and fetcher file**

```go
// service/github/fetcher.go
package github

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

const maxSkillSize = 100 * 1024 // 100KB

// SkillContent represents a fetched skill
type SkillContent struct {
	Name    string
	Content string
}

// Fetcher handles fetching skills from GitHub
type Fetcher struct {
	Token string // Optional GitHub token for higher rate limits
}

// NewFetcher creates a new GitHub fetcher
func NewFetcher(token string) *Fetcher {
	return &Fetcher{Token: token}
}

// ParseGitHubURL parses various GitHub URL formats
func (f *Fetcher) ParseGitHubURL(input string) (owner, repo, skillName string, err error) {
	// Format: owner/repo@skill-name
	specPattern := regexp.MustCompile(`^([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)@([a-zA-Z0-9_-]+)$`)
	if specPattern.MatchString(input) {
		matches := specPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://github.com/owner/repo/tree/branch/skills/skill-name
	treePattern := regexp.MustCompile(`^https://github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/tree/[^/]+/skills/([a-zA-Z0-9_-]+)(?:/SKILL\.md)?/?$`)
	if treePattern.MatchString(input) {
		matches := treePattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://raw.githubusercontent.com/...
	rawPattern := regexp.MustCompile(`^https://raw\.githubusercontent\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/[^/]+/skills/([a-zA-Z0-9_-]+)/SKILL\.md$`)
	if rawPattern.MatchString(input) {
		matches := rawPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	return "", "", "", fmt.Errorf("invalid GitHub URL or spec format: %s", input)
}

// FetchSkill fetches a skill from GitHub
func (f *Fetcher) FetchSkill(owner, repo, skillName string) (*SkillContent, error) {
	client := &http.Client{}

	var apiURL string
	if skillName != "" {
		apiURL = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/skills/%s/SKILL.md", owner, repo, skillName)
	} else {
		apiURL = fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/skills/SKILL.md", owner, repo)
	}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	if f.Token != "" {
		req.Header.Set("Authorization", "Bearer "+f.Token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("skill not found in repository %s/%s", owner, repo)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API error: %s", resp.Status)
	}

	var result struct {
		Content string `json:"content"`
		Size    int    `json:"size"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse GitHub response: %w", err)
	}

	if result.Size > maxSkillSize {
		return nil, fmt.Errorf("skill file too large: %d bytes (max %d)", result.Size, maxSkillSize)
	}

	content, err := base64.StdEncoding.DecodeString(result.Content)
	if err != nil {
		return nil, fmt.Errorf("failed to decode content: %w", err)
	}

	contentStr := string(content)
	if !strings.HasPrefix(strings.TrimSpace(contentStr), "---") {
		return nil, fmt.Errorf("skill must have YAML frontmatter (start with ---)")
	}

	finalName := skillName
	if finalName == "" {
		namePattern := regexp.MustCompile(`(?m)^name:\s*(.+)$`)
		if matches := namePattern.FindStringSubmatch(contentStr); len(matches) > 1 {
			finalName = strings.TrimSpace(matches[1])
		} else {
			finalName = "imported-skill"
		}
	}

	if !regexp.MustCompile(`^[a-z0-9_-]+$`).MatchString(finalName) {
		return nil, fmt.Errorf("skill name must be lowercase letters, numbers, hyphens and underscores only")
	}

	return &SkillContent{Name: finalName, Content: contentStr}, nil
}
```

- [ ] **Step 2: Verify the code compiles**

Run: `cd /root/clawhost && go build ./service/github/...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add service/github/fetcher.go
git commit -m "feat: add GitHub skill fetcher service

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Skill Install and Create Handlers

**Files:**
- Create: `handler/api/v1/agent_skill_install.go`

- [ ] **Step 1: Create the skill install handler file**

```go
// handler/api/v1/agent_skill_install.go
package v1

import (
	"context"
	"regexp"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/github"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type InstallSkillRequest struct {
	Source string `json:"source"` // "github"
	URL    string `json:"url"`    // GitHub URL
	Spec   string `json:"spec"`   // or owner/repo@skill-name format
}

type CreateSkillRequest struct {
	Name    string `json:"name" validate:"required"`
	Content string `json:"content" validate:"required"`
}

// InstallSkill installs a skill from GitHub
func InstallSkill(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running, cannot install skills")
	}

	var req InstallSkillRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Source != "github" {
		return util.BadRequest(c, "only github source is supported")
	}

	input := req.URL
	if input == "" {
		input = req.Spec
	}
	if input == "" {
		return util.BadRequest(c, "url or spec is required")
	}

	// Parse GitHub URL
	fetcher := github.NewFetcher("") // TODO: add GitHub token from config
	owner, repo, skillName, err := fetcher.ParseGitHubURL(input)
	if err != nil {
		return util.BadRequest(c, err.Error())
	}

	// Fetch skill from GitHub
	skill, err := fetcher.FetchSkill(owner, repo, skillName)
	if err != nil {
		return util.BadRequest(c, "failed to fetch skill: "+err.Error())
	}

	// Write skill to pod
	ctx := context.Background()
	if err := k8s.WriteSkill(ctx, agent.ID, "main", skill.Name, skill.Content); err != nil {
		return util.InternalError(c, "failed to write skill: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"name":     skill.Name,
		"installed": true,
	})
}

// CreateSkill creates a new skill from content
func CreateSkill(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running, cannot create skills")
	}

	var req CreateSkillRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Name == "" {
		return util.BadRequest(c, "name is required")
	}
	if req.Content == "" {
		return util.BadRequest(c, "content is required")
	}

	// Validate name format
	if !regexp.MustCompile(`^[a-z0-9_-]+$`).MatchString(req.Name) {
		return util.BadRequest(c, "name must be lowercase letters, numbers, hyphens and underscores only")
	}

	// Validate content has frontmatter
	if !regexp.MustCompile(`(?s)^---`).MatchString(req.Content) {
		return util.BadRequest(c, "content must have YAML frontmatter (start with ---)")
	}

	// Write skill to pod
	ctx := context.Background()
	if err := k8s.WriteSkill(ctx, agent.ID, "main", req.Name, req.Content); err != nil {
		return util.InternalError(c, "failed to write skill: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"name":    req.Name,
		"created": true,
	})
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /root/clawhost && go build ./handler/api/v1/...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add handler/api/v1/agent_skill_install.go
git commit -m "feat: add skill install and create handlers

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Cron Service Functions

**Files:**
- Create: `service/k8s/cron.go`

- [ ] **Step 1: Create the cron service file**

```go
// service/k8s/cron.go
package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// CronJob represents a cron job
type CronJob struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Schedule string `json:"schedule"`
	Timezone string `json:"timezone"`
	Enabled  bool   `json:"enabled"`
	LastRun  string `json:"lastRun,omitempty"`
	NextRun  string `json:"nextRun,omitempty"`
}

// ListCronJobs lists all cron jobs for an agent
func ListCronJobs(ctx context.Context, botID string) ([]CronJob, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	// Execute openclaw cron list --json
	output, err := ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "list", "--json"})
	if err != nil {
		// If command fails, return empty list (cron might not be configured)
		return []CronJob{}, nil
	}

	var jobs []CronJob
	if err := json.Unmarshal([]byte(output), &jobs); err != nil {
		// Try parsing as map with "jobs" key
		var result struct {
			Jobs []CronJob `json:"jobs"`
		}
		if err := json.Unmarshal([]byte(output), &result); err != nil {
			return []CronJob{}, nil
		}
		return result.Jobs, nil
	}

	return jobs, nil
}

// RunCronJob triggers a cron job to run immediately
func RunCronJob(ctx context.Context, botID, jobID string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "run", jobID})
	return err
}

// DeleteCronJob deletes a cron job
func DeleteCronJob(ctx context.Context, botID, jobID string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "remove", jobID})
	return err
}

// ToggleCronJob enables or disables a cron job
func ToggleCronJob(ctx context.Context, botID, jobID string, enabled bool) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	// Try using CLI first
	enabledStr := "true"
	if !enabled {
		enabledStr = "false"
	}
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "edit", jobID, "--enabled", enabledStr})
	if err == nil {
		return nil
	}

	// Fallback: directly modify jobs.json
	return toggleCronJobInFile(ctx, namespace, podName, jobID, enabled)
}

func toggleCronJobInFile(ctx context.Context, namespace, podName, jobID string, enabled bool) error {
	// Read jobs.json
	output, err := ExecInPod(ctx, namespace, podName, "openclaw", []string{"cat", "/home/node/.openclaw/cron/jobs.json"})
	if err != nil {
		return fmt.Errorf("failed to read jobs.json: %w", err)
	}

	var jobsData map[string]interface{}
	if err := json.Unmarshal([]byte(output), &jobsData); err != nil {
		return fmt.Errorf("failed to parse jobs.json: %w", err)
	}

	// Find and update the job
	jobs, ok := jobsData["jobs"].([]interface{})
	if !ok {
		return fmt.Errorf("invalid jobs.json format")
	}

	for i, j := range jobs {
		if job, ok := j.(map[string]interface{}); ok {
			if job["id"] == jobID {
				job["enabled"] = enabled
				jobs[i] = job
				break
			}
		}
	}

	// Write back
	updatedJSON, err := json.Marshal(jobsData)
	if err != nil {
		return fmt.Errorf("failed to marshal jobs.json: %w", err)
	}

	// Use heredoc to write file
	cmd := fmt.Sprintf("cat > /home/node/.openclaw/cron/jobs.json << 'EOFJSON'\n%s\nEOFJSON", string(updatedJSON))
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", cmd})
	return err
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /root/clawhost && go build ./service/k8s/...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add service/k8s/cron.go
git commit -m "feat: add cron service functions for job management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Cron API Handlers

**Files:**
- Create: `handler/api/v1/agent_cron.go`

- [ ] **Step 1: Create the cron handlers file**

```go
// handler/api/v1/agent_cron.go
package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ListCronJobs lists all cron jobs for an agent
func ListCronJobs(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()
	jobs, err := k8s.ListCronJobs(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to list cron jobs: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobs": jobs,
	})
}

// RunCronJob triggers a cron job to run
func RunCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	ctx := context.Background()
	if err := k8s.RunCronJob(ctx, agent.ID, jobID); err != nil {
		return util.InternalError(c, "failed to run cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":     jobID,
		"triggered": true,
	})
}

// ToggleCronJob enables or disables a cron job
func ToggleCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	ctx := context.Background()
	if err := k8s.ToggleCronJob(ctx, agent.ID, jobID, req.Enabled); err != nil {
		return util.InternalError(c, "failed to toggle cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":   jobID,
		"enabled": req.Enabled,
	})
}

// DeleteCronJob deletes a cron job
func DeleteCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	ctx := context.Background()
	if err := k8s.DeleteCronJob(ctx, agent.ID, jobID); err != nil {
		return util.InternalError(c, "failed to delete cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":   jobID,
		"deleted": true,
	})
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /root/clawhost && go build ./handler/api/v1/...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add handler/api/v1/agent_cron.go
git commit -m "feat: add cron job API handlers

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Register API Routes

**Files:**
- Modify: `cmd/server.go`

- [ ] **Step 1: Add skill routes to server.go**

Find the Skills management section (around line 165) and add new routes:

```go
// Skills management
agentAPI.GET("/skills", v1.ListSkills)
agentAPI.PUT("/skills/:name", v1.UpdateSkill)
agentAPI.DELETE("/skills/:name", v1.DeleteSkill)
agentAPI.POST("/skills/install", v1.InstallSkill)    // Add this line
agentAPI.POST("/skills/create", v1.CreateSkill)      // Add this line
```

- [ ] **Step 2: Add cron routes to server.go**

Add after the skills section:

```go
// Cron job management
agentAPI.GET("/cron", v1.ListCronJobs)
agentAPI.POST("/cron/:jobId/run", v1.RunCronJob)
agentAPI.POST("/cron/:jobId/toggle", v1.ToggleCronJob)
agentAPI.DELETE("/cron/:jobId", v1.DeleteCronJob)
```

- [ ] **Step 3: Verify compilation**

Run: `cd /root/clawhost && go build ./cmd/...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add cmd/server.go
git commit -m "feat: register skill and cron API routes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Frontend API Actions

**Files:**
- Modify: `src/lib/actions.ts`

- [ ] **Step 1: Add skill and cron API functions to actions.ts**

Add after the existing exports:

```typescript
// Skill management
export async function installSkill(agentId: string, urlOrSpec: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills/install`, {
    method: "POST",
    body: JSON.stringify({ source: "github", url: urlOrSpec, spec: urlOrSpec }),
  });
  const data = (await res.json()) as ApiResponse<{ name: string; installed: boolean }>;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to install skill" };
  }
  return { success: true, name: data.data?.name };
}

export async function createSkill(agentId: string, name: string, content: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills/create`, {
    method: "POST",
    body: JSON.stringify({ name, content }),
  });
  const data = (await res.json()) as ApiResponse<{ name: string; created: boolean }>;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to create skill" };
  }
  return { success: true, name: data.data?.name };
}

// Cron job management
export async function listCronJobs(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron`);
  const data = (await res.json()) as ApiResponse<{ jobs: CronJob[] }>;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list cron jobs" };
  }
  return { jobs: data.data?.jobs || [] };
}

export async function runCronJob(agentId: string, jobId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}/run`, {
    method: "POST",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to run cron job" };
  }
  return { success: true };
}

export async function toggleCronJob(agentId: string, jobId: string, enabled: boolean) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to toggle cron job" };
  }
  return { success: true };
}

export async function deleteCronJob(agentId: string, jobId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/cron/${jobId}`, {
    method: "DELETE",
  });
  const data = (await res.json()) as ApiResponse;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete cron job" };
  }
  return { success: true };
}
```

Also add the CronJob type at the top of the file (after imports):

```typescript
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat: add skill and cron API action functions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: i18n Translations

**Files:**
- Modify: `src/messages/zh.json`
- Modify: `src/messages/en.json`

- [ ] **Step 1: Update zh.json skills and add tasks section**

Replace the `agent.skills` section and add `agent.tasks`:

```json
"skills": {
  "title": "技能",
  "install": "安装 Skill",
  "create": "创建 Skill",
  "installTitle": "从 GitHub 安装 Skill",
  "installPlaceholder": "owner/repo@skill-name",
  "installHint": "示例: muranUSTB/skills-create_skills@skills-creator",
  "installing": "安装中...",
  "installed": "Skill 安装成功",
  "installFailed": "安装失败",
  "createTitle": "创建新 Skill",
  "namePlaceholder": "my-skill",
  "nameHint": "仅支持小写字母、数字、连字符和下划线",
  "contentPlaceholder": "---\nname: my-skill\ndescription: ...\n---\n# My Skill\n...",
  "creating": "创建中...",
  "created": "Skill 创建成功",
  "delete": "删除技能",
  "deleteConfirm": "确定要删除 \"{name}\" 吗？",
  "deleted": "技能已删除",
  "empty": "暂无技能，从 GitHub 导入或创建新技能"
},
"tasks": {
  "title": "定时任务",
  "empty": "暂无定时任务",
  "run": "执行",
  "running": "执行中...",
  "ran": "任务已触发",
  "delete": "删除任务",
  "deleteConfirm": "确定要删除 \"{name}\" 吗？",
  "deleted": "任务已删除",
  "enabled": "已启用",
  "disabled": "已禁用",
  "lastRun": "上次执行",
  "nextRun": "下次执行"
}
```

- [ ] **Step 2: Update en.json skills and add tasks section**

```json
"skills": {
  "title": "Skills",
  "install": "Install Skill",
  "create": "Create Skill",
  "installTitle": "Install Skill from GitHub",
  "installPlaceholder": "owner/repo@skill-name",
  "installHint": "Example: muranUSTB/skills-create_skills@skills-creator",
  "installing": "Installing...",
  "installed": "Skill installed successfully",
  "installFailed": "Installation failed",
  "createTitle": "Create New Skill",
  "namePlaceholder": "my-skill",
  "nameHint": "Only lowercase letters, numbers, hyphens and underscores",
  "contentPlaceholder": "---\nname: my-skill\ndescription: ...\n---\n# My Skill\n...",
  "creating": "Creating...",
  "created": "Skill created successfully",
  "delete": "Delete Skill",
  "deleteConfirm": "Are you sure you want to delete \"{name}\"?",
  "deleted": "Skill deleted",
  "empty": "No skills yet. Install from GitHub or create a new one."
},
"tasks": {
  "title": "Scheduled Tasks",
  "empty": "No scheduled tasks",
  "run": "Run",
  "running": "Running...",
  "ran": "Task triggered",
  "delete": "Delete Task",
  "deleteConfirm": "Are you sure you want to delete \"{name}\"?",
  "deleted": "Task deleted",
  "enabled": "Enabled",
  "disabled": "Disabled",
  "lastRun": "Last run",
  "nextRun": "Next run"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/messages/zh.json src/messages/en.json
git commit -m "feat: add i18n translations for skills and tasks

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Skill Install Dialog Component

**Files:**
- Create: `src/components/skill-install-dialog.tsx`

- [ ] **Step 1: Create the install dialog component**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { installSkill } from "@/lib/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

export function SkillInstallDialog({ open, onOpenChange, agentId, onSuccess }: Props) {
  const t = useTranslations();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInstall() {
    if (!url.trim()) {
      toast.error(t("common.error"));
      return;
    }

    setLoading(true);
    const result = await installSkill(agentId, url.trim());
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.installed"));
      setUrl("");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent.skills.installTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="github-url">GitHub URL / Spec</Label>
            <Input
              id="github-url"
              placeholder={t("agent.skills.installPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInstall()}
            />
            <p className="text-xs text-muted-foreground">
              {t("agent.skills.installHint")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleInstall} disabled={loading}>
            {loading ? t("agent.skills.installing") : t("agent.skills.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skill-install-dialog.tsx
git commit -m "feat: add skill install dialog component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Skill Create Dialog Component

**Files:**
- Create: `src/components/skill-create-dialog.tsx`

- [ ] **Step 1: Create the create dialog component**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSkill } from "@/lib/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

const defaultContent = `---
name: my-skill
description: A new skill
---

# My Skill

Describe your skill here...
`;

export function SkillCreateDialog({ open, onOpenChange, agentId, onSuccess }: Props) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error(t("common.error"));
      return;
    }

    setLoading(true);
    const result = await createSkill(agentId, name.trim(), content);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.skills.created"));
      setName("");
      setContent(defaultContent);
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("agent.skills.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">{t("agent.skills.createTitle")}</Label>
            <Input
              id="skill-name"
              placeholder={t("agent.skills.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("agent.skills.nameHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-content">Markdown</Label>
            <textarea
              id="skill-content"
              className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder={t("agent.skills.contentPlaceholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? t("agent.skills.creating") : t("agent.skills.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skill-create-dialog.tsx
git commit -m "feat: add skill create dialog component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Update Skills Page

**Files:**
- Modify: `src/app/(dashboard)/agents/[id]/skills/page.tsx`

- [ ] **Step 1: Add install and create buttons to skills page**

Replace the entire file content:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkillList } from "@/components/skill-list";
import { SkillInstallDialog } from "@/components/skill-install-dialog";
import { SkillCreateDialog } from "@/components/skill-create-dialog";
import { listSkills } from "@/lib/actions";
import { Download, Plus } from "lucide-react";

interface Skill {
  name: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installOpen, setInstallOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadSkills();
  }, [agentId]);

  async function loadSkills() {
    setLoading(true);
    const result = await listSkills(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setSkills(result.skills || []);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.skills.title")}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstallOpen(true)}
            >
              <Download className="w-4 h-4 mr-1" />
              {t("agent.skills.install")}
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t("agent.skills.create")}
            </Button>
          </div>
        </div>
        <div className="glass-panel-content">
          <SkillList
            agentId={agentId}
            skills={skills}
            loading={loading}
            onRefresh={loadSkills}
          />
        </div>
      </div>

      <SkillInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/agents/\[id\]/skills/page.tsx
git commit -m "feat: add install and create buttons to skills page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Switch UI Component

**Files:**
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Create the switch component**

```tsx
"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input ${className || ""}`}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0`}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

- [ ] **Step 2: Install radix-ui switch dependency**

Run: `cd /root/clawhost/portal && pnpm add @radix-ui/react-switch`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/switch.tsx package.json pnpm-lock.yaml
git commit -m "feat: add switch UI component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Task List Component

**Files:**
- Create: `src/components/task-list.tsx`

- [ ] **Step 1: Create the task list component**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "./confirm-dialog";
import { runCronJob, toggleCronJob, deleteCronJob } from "@/lib/actions";
import { Play, Trash2 } from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface Props {
  agentId: string;
  jobs: CronJob[];
  loading: boolean;
  onRefresh: () => void;
}

export function TaskList({ agentId, jobs, loading, onRefresh }: Props) {
  const t = useTranslations();
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRun(jobId: string) {
    setRunningJob(jobId);
    const result = await runCronJob(agentId, jobId);
    setRunningJob(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.tasks.ran"));
      onRefresh();
    }
  }

  async function handleToggle(jobId: string, enabled: boolean) {
    const result = await toggleCronJob(agentId, jobId, enabled);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(enabled ? t("agent.tasks.enabled") : t("agent.tasks.disabled"));
      onRefresh();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCronJob(agentId, deleteTarget.id);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("agent.tasks.deleted"));
      setDeleteTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("agent.tasks.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent"
          >
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${job.enabled ? "bg-green-500" : "bg-gray-400"}`} />
              <div>
                <div className="font-medium text-foreground">{job.name}</div>
                <div className="text-sm text-muted-foreground">
                  {job.schedule}
                  {job.timezone && ` (${job.timezone})`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={job.enabled}
                  onCheckedChange={(checked) => handleToggle(job.id, checked)}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRun(job.id)}
                disabled={runningJob === job.id}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(job)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t("agent.tasks.delete")}
        description={deleteTarget ? t("agent.tasks.deleteConfirm", { name: deleteTarget.name }) : ""}
        loading={deleting}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task-list.tsx
git commit -m "feat: add task list component for cron jobs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Tasks Page

**Files:**
- Create: `src/app/(dashboard)/agents/[id]/tasks/page.tsx`

- [ ] **Step 1: Create the tasks page**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TaskList } from "@/components/task-list";
import { listCronJobs } from "@/lib/actions";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export default function TasksPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, [agentId]);

  async function loadJobs() {
    setLoading(true);
    const result = await listCronJobs(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setJobs(result.jobs || []);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.tasks.title")}
          </span>
        </div>
        <div className="glass-panel-content">
          <TaskList
            agentId={agentId}
            jobs={jobs}
            loading={loading}
            onRefresh={loadJobs}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/agents/\[id\]/tasks/page.tsx
git commit -m "feat: add tasks page for cron job management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Add Tasks Navigation

**Files:**
- Modify: `src/components/agent-detail-header.tsx`

- [ ] **Step 1: Add Tasks tab to navigation**

Find the tabs array and add the Tasks entry. Look for the existing tabs (Overview, Config, Skills, etc.) and add:

```tsx
{ id: "tasks", label: t("agent.tasks.title") }
```

The exact location depends on the existing structure. Add it after Skills.

- [ ] **Step 2: Commit**

```bash
git add src/components/agent-detail-header.tsx
git commit -m "feat: add Tasks navigation tab

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Final Verification and Push

- [ ] **Step 1: Build and verify backend**

Run: `cd /root/clawhost && go build -o clawhost .`
Expected: No errors

- [ ] **Step 2: Build and verify frontend**

Run: `cd /root/clawhost/portal && pnpm build`
Expected: No errors

- [ ] **Step 3: Push all commits**

```bash
cd /root/clawhost && git push origin dev
cd /root/clawhost/portal && git push origin dev
```