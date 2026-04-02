package v1

import (
	"context"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type UpdateAgentRequest struct {
	Name      string                 `json:"name,omitempty"`
	Slug      string                 `json:"slug,omitempty"`
	Config    map[string]interface{} `json:"config,omitempty"` // OpenClaw native config format
	ExpiresAt *time.Time             `json:"expires_at,omitempty"`
}

func UpdateAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	var req UpdateAgentRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Name != "" {
		agent.Name = req.Name
	}

	if req.Slug != "" {
		if !isValidSlug(req.Slug) {
			return util.BadRequest(c, "slug must be 1-50 characters, lowercase letters, numbers, and hyphens only")
		}
		// Check if slug is already taken by another agent
		existing, _ := model.GetAgentBySlug(req.Slug)
		if existing != nil && existing.ID != agent.ID {
			return util.BadRequest(c, "slug is already taken")
		}
		agent.Slug = req.Slug
	}

	// Update config if provided (OpenClaw native format)
	if req.Config != nil {
		if err := agent.SetConfigMap(req.Config); err != nil {
			return util.InternalError(c, "failed to set config")
		}
	}

	// Update expiration time (for renewal)
	if req.ExpiresAt != nil {
		agent.ExpiresAt = req.ExpiresAt
	}

	if err := model.UpdateAgent(agent); err != nil {
		return util.InternalError(c, "failed to update agent")
	}

	// If agent is running and config was updated, sync to pod
	if req.Config != nil && agent.Status == model.AgentStatusRunning {
		go func() {
			ctx := context.Background()
			if err := k8s.SyncConfigToPod(ctx, agent.ID); err != nil {
				c.Logger().Errorf("failed to sync config to pod: %v", err)
			}
		}()
	}

	return util.Success(c, agent)
}
