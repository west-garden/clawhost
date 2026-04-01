package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func ResetAgentToken(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	// Reset the access token
	newToken, err := model.ResetAgentAccessToken(agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to reset access token")
	}

	// Update config in database with new token
	updatedAgent, err := model.GetAgentByID(agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to reload agent")
	}

	openclawConfig, _ := updatedAgent.GetOpenClawConfig()
	if openclawConfig == nil {
		openclawConfig = &model.OpenClawConfig{}
	}
	// Ensure gateway.auth.token is updated
	if openclawConfig.Gateway == nil {
		openclawConfig.Gateway = &model.GatewayConfig{}
	}
	if openclawConfig.Gateway.Auth == nil {
		openclawConfig.Gateway.Auth = &model.GatewayAuthConfig{}
	}
	openclawConfig.Gateway.Auth.Mode = "token"
	openclawConfig.Gateway.Auth.Token = newToken

	// Save updated config to database
	if err := updatedAgent.SetOpenClawConfig(openclawConfig); err != nil {
		c.Logger().Warnf("failed to update config with new token: %v", err)
	} else if err := model.UpdateAgent(updatedAgent); err != nil {
		c.Logger().Warnf("failed to save config with new token: %v", err)
	}

	// If agent is running, update deployment with new token
	if agent.Status == model.AgentStatusRunning {
		ctx := context.Background()
		k8sConfig := convertToK8sConfig(updatedAgent, openclawConfig)

		// Update deployment spec with new token (this updates the startup command)
		if err := k8s.UpdateDeploymentConfig(ctx, agent.ID, newToken, k8sConfig); err != nil {
			c.Logger().Warnf("failed to update deployment after token reset: %v", err)
		}
	}

	return util.Success(c, map[string]interface{}{
		"id":           agent.ID,
		"access_token": newToken,
		"access_url":   buildAccessURL(agent.Slug, newToken),
		"message":      "access token has been reset",
	})
}
