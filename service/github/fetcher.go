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

// Pre-compiled regex patterns for URL parsing and validation
var (
	// specPattern matches: owner/repo@skill-name (lowercase only for consistency)
	specPattern = regexp.MustCompile(`^([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)@([a-z0-9_-]+)$`)
	// treePattern matches: https://github.com/owner/repo/tree/branch/skills/skill-name
	treePattern = regexp.MustCompile(`^https://github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/tree/[^/]+/skills/([a-z0-9_-]+)(?:/SKILL\.md)?/?$`)
	// rawPattern matches: https://raw.githubusercontent.com/owner/repo/branch/skills/skill-name/SKILL.md
	rawPattern = regexp.MustCompile(`^https://raw\.githubusercontent\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)/[^/]+/skills/([a-z0-9_-]+)/SKILL\.md$`)
	// namePattern extracts skill name from YAML frontmatter
	namePattern = regexp.MustCompile(`(?m)^name:\s*(.+)$`)
	// validNamePattern validates skill name (lowercase only)
	validNamePattern = regexp.MustCompile(`^[a-z0-9_-]+$`)
	// defaultHTTPClient is the shared HTTP client for all requests
	defaultHTTPClient = &http.Client{}
)

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
	if specPattern.MatchString(input) {
		matches := specPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://github.com/owner/repo/tree/branch/skills/skill-name
	if treePattern.MatchString(input) {
		matches := treePattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	// Format: https://raw.githubusercontent.com/...
	if rawPattern.MatchString(input) {
		matches := rawPattern.FindStringSubmatch(input)
		return matches[1], matches[2], matches[3], nil
	}

	return "", "", "", fmt.Errorf("invalid GitHub URL or spec format: %s", input)
}

// FetchSkill fetches a skill from GitHub
func (f *Fetcher) FetchSkill(owner, repo, skillName string) (*SkillContent, error) {
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

	resp, err := defaultHTTPClient.Do(req)
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
		if matches := namePattern.FindStringSubmatch(contentStr); len(matches) > 1 {
			finalName = strings.TrimSpace(matches[1])
		} else {
			finalName = "imported-skill"
		}
	}

	if !validNamePattern.MatchString(finalName) {
		return nil, fmt.Errorf("skill name must be lowercase letters, numbers, hyphens and underscores only")
	}

	return &SkillContent{Name: finalName, Content: contentStr}, nil
}