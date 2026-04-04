package v1

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/github"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/service/skills"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type InstallSkillRequest struct {
	Source string `json:"source"` // "github" or "zip"
	URL    string `json:"url"`    // GitHub URL or zip download URL
	Spec   string `json:"spec"`   // or owner/repo@skill-name format
}

type CreateSkillRequest struct {
	Name        string `json:"name" validate:"required"`
	Content     string `json:"content" validate:"required"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
}

// InstallSkill installs a skill from GitHub or zip URL
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

	if req.Source != "github" && req.Source != "zip" {
		return util.BadRequest(c, "only github or zip source is supported")
	}

	input := req.URL
	if input == "" {
		input = req.Spec
	}
	if input == "" {
		return util.BadRequest(c, "url or spec is required")
	}

	ctx := context.Background()

	if req.Source == "zip" {
		skillName, err := installFromZip(ctx, agent.ID, input)
		if err != nil {
			return util.BadRequest(c, err.Error())
		}
		return util.Success(c, map[string]interface{}{
			"name":      skillName,
			"installed": true,
		})
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
	if err := k8s.WriteSkill(ctx, agent.ID, "main", skill.Name, skill.Content); err != nil {
		return util.InternalError(c, "failed to write skill: "+err.Error())
	}

	// Extract metadata from skill content and write metadata file
	meta := extractMetaFromContent(skill.Content)
	meta.Source = "github"
	if meta.Author == "" {
		meta.Author = owner
	}
	if err := skills.WriteSkillMeta(ctx, agent.ID, "main", skill.Name, meta); err != nil {
		// Non-critical error, log but don't fail
		// metadata will be extracted from content on list
	}

	return util.Success(c, map[string]interface{}{
		"name":      skill.Name,
		"installed": true,
	})
}

// installFromZip installs a skill from a zip URL
// The zip file should contain the skill files (SKILL.md or {skill-name}.md, and optional _meta.json)
// Returns the skill name on success
func installFromZip(ctx context.Context, agentID, zipURL string) (string, error) {
	// Download zip file
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(zipURL)
	if err != nil {
		return "", fmt.Errorf("failed to download zip: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to download zip: HTTP %d", resp.StatusCode)
	}

	// Read zip content
	zipData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read zip data: %w", err)
	}

	// Parse zip
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return "", fmt.Errorf("failed to parse zip: %w", err)
	}

	// Find skill name and content
	var skillName string
	var skillContent string
	var meta *skills.SkillMeta

	for _, file := range zipReader.File {
		// Skip directories
		if file.FileInfo().IsDir() {
			continue
		}

		// Get base filename
		baseName := file.Name
		if idx := strings.LastIndex(file.Name, "/"); idx >= 0 {
			baseName = file.Name[idx+1:]
		}

		// Open file
		rc, err := file.Open()
		if err != nil {
			continue
		}

		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			continue
		}

		// Check for SKILL.md or .md file
		if baseName == "SKILL.md" || strings.HasSuffix(baseName, ".md") {
			skillContent = string(content)
			// Extract skill name from filename if not SKILL.md
			if baseName != "SKILL.md" {
				skillName = strings.TrimSuffix(baseName, ".md")
			}
			// Extract metadata from content
			meta = extractMetaFromContent(skillContent)
		}

		// Check for _meta.json
		if baseName == "_meta.json" {
			var m skills.SkillMeta
			if err := json.Unmarshal(content, &m); err == nil {
				meta = &m
			}
		}
	}

	if skillContent == "" {
		return "", fmt.Errorf("no skill markdown file found in zip")
	}

	// If skill name not found from filename, try metadata
	if skillName == "" && meta != nil && meta.Name != "" {
		// Convert display name to slug
		skillName = slugify(meta.Name)
	}
	if skillName == "" {
		return "", fmt.Errorf("could not determine skill name")
	}

	// Write skill to pod
	if err := k8s.WriteSkill(ctx, agentID, "main", skillName, skillContent); err != nil {
		return "", fmt.Errorf("failed to write skill: %w", err)
	}

	// Write metadata
	if meta == nil {
		meta = &skills.SkillMeta{}
	}
	meta.Source = "zip"
	if err := skills.WriteSkillMeta(ctx, agentID, "main", skillName, meta); err != nil {
		// Non-critical error
	}

	return skillName, nil
}

// slugify converts a string to a URL-safe slug
func slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)
	// Replace spaces with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	// Remove non-alphanumeric characters except hyphens
	reg := regexp.MustCompile("[^a-z0-9-]")
	s = reg.ReplaceAllString(s, "")
	// Remove multiple consecutive hyphens
	reg = regexp.MustCompile("-+")
	s = reg.ReplaceAllString(s, "-")
	// Trim hyphens from ends
	s = strings.Trim(s, "-")
	return s
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

	// Validate content size (max 100KB)
	const maxSkillSize = 100 * 1024
	if len(req.Content) > maxSkillSize {
		return util.BadRequest(c, "content too large (max 100KB)")
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

	// Write metadata
	meta := extractMetaFromContent(req.Content)
	meta.Source = "manual"
	if meta.Description == "" && req.Description != "" {
		meta.Description = req.Description
	}
	if meta.Author == "" && req.Author != "" {
		meta.Author = req.Author
	}
	if meta.Version == "" && req.Version != "" {
		meta.Version = req.Version
	}
	if err := skills.WriteSkillMeta(ctx, agent.ID, "main", req.Name, meta); err != nil {
		// Non-critical error
	}

	return util.Success(c, map[string]interface{}{
		"name":    req.Name,
		"created": true,
	})
}

// extractMetaFromContent extracts metadata from skill markdown frontmatter
func extractMetaFromContent(content string) *skills.SkillMeta {
	meta := &skills.SkillMeta{}

	// Extract YAML frontmatter
	frontmatterRegex := regexp.MustCompile(`(?s)^---\n(.*?)\n---`)
	matches := frontmatterRegex.FindStringSubmatch(content)
	if len(matches) < 2 {
		return meta
	}

	frontmatter := matches[1]

	// Extract name
	nameRegex := regexp.MustCompile(`(?m)^name:\s*(.+)$`)
	if nameMatches := nameRegex.FindStringSubmatch(frontmatter); len(nameMatches) > 1 {
		meta.Name = strings.TrimSpace(nameMatches[1])
	}

	// Extract description
	descRegex := regexp.MustCompile(`(?m)^description:\s*(.+)$`)
	if descMatches := descRegex.FindStringSubmatch(frontmatter); len(descMatches) > 1 {
		meta.Description = strings.TrimSpace(descMatches[1])
	}

	// Extract author
	authorRegex := regexp.MustCompile(`(?m)^author:\s*(.+)$`)
	if authorMatches := authorRegex.FindStringSubmatch(frontmatter); len(authorMatches) > 1 {
		meta.Author = strings.TrimSpace(authorMatches[1])
	}

	// Extract version
	versionRegex := regexp.MustCompile(`(?m)^version:\s*(.+)$`)
	if versionMatches := versionRegex.FindStringSubmatch(frontmatter); len(versionMatches) > 1 {
		meta.Version = strings.TrimSpace(versionMatches[1])
	}

	return meta
}