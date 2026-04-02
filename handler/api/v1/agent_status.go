package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type AgentStatusResponse struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Status   model.AgentStatus `json:"status"`
	Ready    bool              `json:"ready"`
	Endpoint string            `json:"endpoint,omitempty"`
}

func GetAgentStatus(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	response := AgentStatusResponse{
		ID:       agent.ID,
		Name:     agent.Name,
		Status:   agent.Status,
		Endpoint: agent.Endpoint,
	}

	// Check actual K8s status if agent is supposed to be running
	if agent.Status == model.AgentStatusRunning {
		ctx := context.Background()
		ready, err := k8s.GetDeploymentStatus(ctx, agent.ID)
		if err != nil {
			response.Ready = false
		} else {
			response.Ready = ready
			// Sync status: if K8s deployment doesn't exist, update DB to stopped
			if !ready {
				exists, _ := k8s.DeploymentExists(ctx, agent.ID)
				if !exists {
					agent.Status = model.AgentStatusStopped
					agent.Endpoint = ""
					model.UpdateAgent(agent)
					response.Status = model.AgentStatusStopped
					response.Endpoint = ""
				}
			}
		}
	}

	return util.Success(c, response)
}
