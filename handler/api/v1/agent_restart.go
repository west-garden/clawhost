package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func RestartAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()

	// Build current config
	openclawConfig, _ := agent.GetOpenClawConfig()
	k8sConfig := convertToK8sConfig(agent, openclawConfig)

	// Replace deployment spec with rolling update -- picks up all changes
	// (ChatClaw sidecar, image updates, resource changes) without downtime
	if err := k8s.ReplaceDeployment(ctx, agent.ID, agent.UserID, agent.AccessToken, k8sConfig); err != nil {
		return util.InternalError(c, "failed to update deployment: "+err.Error())
	}

	// Recreate service to pick up port changes (e.g., ChatClaw port added/removed)
	// DeleteService + CreateService is safe -- existing connections drain naturally
	// during the rolling update window
	k8s.DeleteService(ctx, agent.ID)
	endpoint, err := k8s.CreateService(ctx, agent.ID, agent.UserID)
	if err != nil {
		return util.InternalError(c, "failed to create service: "+err.Error())
	}

	// Update endpoint
	if err := model.UpdateAgentStatus(agent.ID, model.AgentStatusRunning, endpoint); err != nil {
		c.Logger().Errorf("failed to update agent endpoint: %v", err)
	}

	// Sync config to pod after restart
	go func() {
		if k8sConfig.AccessToken != "" {
			if err := k8s.WriteConfigToAgent(context.Background(), agent.ID, k8sConfig, false); err != nil {
				c.Logger().Errorf("failed to write config to agent: %v", err)
			}
		}
	}()

	return util.Success(c, agent)
}
