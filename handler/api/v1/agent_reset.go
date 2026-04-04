package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ResetAgent resets an agent to its initial state.
// It clears the openclaw.json config file from the pod, then restarts.
// On restart, the config will be re-created from the database (preserving providers).
// This clears: channels, agents config, skills, but preserves: models/providers.
func ResetAgent(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()

	// Get pod name
	podName, err := k8s.GetPodName(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to get pod: "+err.Error())
	}

	// Delete the openclaw.json config file
	// This will cause the pod to re-create it from database on restart
	_, err = k8s.ExecInPod(ctx, k8s.GetNamespace(), podName, "openclaw",
		[]string{"sh", "-c", "rm -f /home/node/.openclaw/openclaw.json"})
	if err != nil {
		c.Logger().Warnf("failed to delete config file: %v", err)
		// Continue anyway, restart might still work
	}

	// Delete channels config (weixin accounts, etc.)
	k8s.ExecInPod(ctx, k8s.GetNamespace(), podName, "openclaw",
		[]string{"sh", "-c", "rm -rf /home/node/.openclaw/openclaw-weixin"})
	k8s.ExecInPod(ctx, k8s.GetNamespace(), podName, "openclaw",
		[]string{"sh", "-c", "rm -rf /home/node/.openclaw/cron"})

	// Restart the deployment
	if err := k8s.RestartDeployment(ctx, agent.ID); err != nil {
		return util.InternalError(c, "failed to restart deployment: "+err.Error())
	}

	return util.Success(c, map[string]string{
		"message": "agent reset successfully",
	})
}