package v1

import (
	"regexp"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

const maxConfigSize = 64 * 1024 // 64KB max config size

type CreateAgentRequest struct {
	Name      string                 `json:"name" validate:"required"`
	Slug      string                 `json:"slug,omitempty"` // Optional custom slug
	Config    map[string]interface{} `json:"config,omitempty"`
	ExpiresAt *time.Time             `json:"expires_at,omitempty"` // Optional expiration time
}

type AgentResponse struct {
	*model.Agent
	AccessURL string `json:"access_url"`
}

func CreateAgent(c echo.Context) error {
	var req CreateAgentRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Name == "" {
		return util.BadRequest(c, "name is required")
	}

	// Validate name length
	if len(req.Name) > 100 {
		return util.BadRequest(c, "name must be 100 characters or less")
	}

	// Validate slug if provided
	if req.Slug != "" {
		if !isValidSlug(req.Slug) {
			return util.BadRequest(c, "slug must be 1-50 characters, lowercase letters, numbers, and hyphens only")
		}
		// Check if slug is already taken
		existing, _ := model.GetAgentBySlug(req.Slug)
		if existing != nil {
			return util.BadRequest(c, "slug is already taken")
		}
	}

	// Validate config size if provided
	if req.Config != nil {
		if err := util.ValidateConfigSize(req.Config, maxConfigSize); err != nil {
			return util.BadRequest(c, "config too large (max 64KB)")
		}
	}

	// Get user_id from JWT claims
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}

	agent := &model.Agent{
		UserID:    claims.UserID,
		Name:      req.Name,
		Slug:      req.Slug, // Will be auto-generated if empty
		Status:    model.AgentStatusCreated,
		ExpiresAt: req.ExpiresAt,
	}

	// Set config if provided (OpenClaw native format)
	if req.Config != nil {
		if err := agent.SetConfigMap(req.Config); err != nil {
			return util.InternalError(c, "failed to set config")
		}
	}

	if err := model.CreateAgent(agent); err != nil {
		return util.InternalError(c, "failed to create agent")
	}

	return util.Success(c, &AgentResponse{
		Agent:     agent,
		AccessURL: buildAccessURL(agent.Slug, agent.AccessToken),
	})
}

func isValidSlug(slug string) bool {
	if len(slug) < 1 || len(slug) > 50 {
		return false
	}
	// Allow single character or multiple characters (must start and end with alphanumeric)
	matched, _ := regexp.MatchString("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", slug)
	return matched
}

// isValidSlug validates a bot slug
