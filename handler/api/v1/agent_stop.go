package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func StopAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()

	// Delete K8s deployment (this keeps the PVC data)
	if err := k8s.DeleteDeployment(ctx, agent.ID); err != nil {
		return util.InternalError(c, "failed to delete deployment: "+err.Error())
	}

	// Delete K8s service
	if err := k8s.DeleteService(ctx, agent.ID); err != nil {
		return util.InternalError(c, "failed to delete service: "+err.Error())
	}

	// Update agent status
	if err := model.UpdateAgentStatus(agent.ID, model.AgentStatusStopped, ""); err != nil {
		return util.InternalError(c, "failed to update agent status")
	}

	agent.Status = model.AgentStatusStopped
	agent.Endpoint = ""

	return util.Success(c, agent)
}
