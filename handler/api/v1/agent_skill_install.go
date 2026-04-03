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