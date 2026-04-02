package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func DeleteAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	ctx := context.Background()

	// Delete K8s resources if running
	if agent.Status == model.AgentStatusRunning {
		if err := k8s.DeleteDeployment(ctx, agent.ID); err != nil {
			return util.InternalError(c, "failed to delete deployment")
		}
		if err := k8s.DeleteService(ctx, agent.ID); err != nil {
			return util.InternalError(c, "failed to delete service")
		}
	}

	// Delete from database
	if err := model.DeleteAgent(agent.ID); err != nil {
		return util.InternalError(c, "failed to delete agent")
	}

	// TODO: Clean up NAS data directory

	return util.Success(c, map[string]string{"message": "agent deleted"})
}
