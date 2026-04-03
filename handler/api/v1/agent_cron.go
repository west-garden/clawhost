package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ListCronJobs lists all cron jobs for an agent
func ListCronJobs(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()
	jobs, err := k8s.ListCronJobs(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to list cron jobs: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobs": jobs,
	})
}

// RunCronJob triggers a cron job to run
func RunCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	ctx := context.Background()
	if err := k8s.RunCronJob(ctx, agent.ID, jobID); err != nil {
		return util.InternalError(c, "failed to run cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":     jobID,
		"triggered": true,
	})
}

// ToggleCronJob enables or disables a cron job
func ToggleCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	ctx := context.Background()
	if err := k8s.ToggleCronJob(ctx, agent.ID, jobID, req.Enabled); err != nil {
		return util.InternalError(c, "failed to toggle cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":   jobID,
		"enabled": req.Enabled,
	})
}

// DeleteCronJob deletes a cron job
func DeleteCronJob(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		return util.BadRequest(c, "jobId is required")
	}

	ctx := context.Background()
	if err := k8s.DeleteCronJob(ctx, agent.ID, jobID); err != nil {
		return util.InternalError(c, "failed to delete cron job: "+err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"jobId":   jobID,
		"deleted": true,
	})
}
