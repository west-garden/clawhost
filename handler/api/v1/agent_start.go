package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func StartAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status == model.AgentStatusRunning {
		return util.BadRequest(c, "agent is already running")
	}

	ctx := context.Background()

	// Get agent config for deployment
	openclawConfig, _ := agent.GetOpenClawConfig()
	k8sConfig := convertToK8sConfig(agent, openclawConfig)

	// Create K8s deployment
	if err := k8s.CreateDeployment(ctx, agent.ID, agent.UserID, agent.AccessToken, k8sConfig); err != nil {
		return util.InternalError(c, "failed to create deployment: "+err.Error())
	}

	// Create K8s service
	endpoint, err := k8s.CreateService(ctx, agent.ID, agent.UserID)
	if err != nil {
		// Rollback deployment
		k8s.DeleteDeployment(ctx, agent.ID)
		return util.InternalError(c, "failed to create service: "+err.Error())
	}

	// Update agent status
	if err := model.UpdateAgentStatus(agent.ID, model.AgentStatusRunning, endpoint); err != nil {
		return util.InternalError(c, "failed to update agent status")
	}

	// Write config file to pod (async, don't block the response)
	// Config is required for token auth
	if k8sConfig.AccessToken != "" {
		go func() {
			// On start, only set default model if user hasn't configured one
			if err := k8s.WriteConfigToAgent(context.Background(), agent.ID, k8sConfig, false); err != nil {
				// Log error but don't fail the request
				c.Logger().Errorf("failed to write config to agent: %v", err)
			}
		}()
	}

	agent.Status = model.AgentStatusRunning
	agent.Endpoint = endpoint

	return util.Success(c, agent)
}
