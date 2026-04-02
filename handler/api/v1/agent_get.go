package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
)

// GetAgentResponse includes agent info and deployment status
type GetAgentResponse struct {
	*model.Agent
	DeploymentStatus *k8s.DeploymentStatusInfo `json:"deployment_status,omitempty"`
	Image            string                     `json:"image,omitempty"`
	LatestImage      string                     `json:"latest_image,omitempty"`
	ImageUpToDate    *bool                      `json:"image_up_to_date,omitempty"`
}

func GetAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	ctx := context.Background()
	response := &GetAgentResponse{Agent: agent}

	// If agent is running, get deployment status, image info, and sync config
	if agent.Status == model.AgentStatusRunning {
		// Get deployment status
		if statusInfo, err := k8s.GetDeploymentStatusInfo(ctx, agent.ID); err == nil {
			response.DeploymentStatus = statusInfo
		}

		// Get current and latest image for upgrade check
		if currentImage, err := k8s.GetDeploymentImage(ctx, agent.ID); err == nil {
			response.Image = currentImage
			latestImage := viper.GetString("openclaw.image")
			if latestImage != "" {
				response.LatestImage = latestImage
				upToDate := currentImage == latestImage
				response.ImageUpToDate = &upToDate
			}
		}

		// Only sync config if deployment is ready (not during updates)
		if response.DeploymentStatus != nil && response.DeploymentStatus.Status == "ready" {
			if err := k8s.SyncConfigToDatabase(ctx, agent.ID); err != nil {
				c.Logger().Warnf("failed to sync config from pod: %v", err)
			} else {
				// Reload agent to get updated config
				if updatedAgent, err := model.GetAgentByID(agent.ID); err == nil {
					response.Agent = updatedAgent
				}
			}
		}
	}

	return util.Success(c, response)
}
