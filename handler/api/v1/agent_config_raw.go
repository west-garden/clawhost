package v1

import (
	"context"
	"encoding/json"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// GetAgentRawConfig reads the openclaw.json config from the agent's running pod
// GET /api/v1/agents/:id/config/raw
func GetAgentRawConfig(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()
	config, err := k8s.ReadAgentRawConfig(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to read config: "+err.Error())
	}

	return util.Success(c, config)
}

// UpdateAgentRawConfig writes the openclaw.json config to the agent's running pod
// PUT /api/v1/agents/:id/config/raw
//
// Accepts either a full config (replaces entirely) or a partial config (merged).
// Query param: ?mode=merge (default) or ?mode=replace
func UpdateAgentRawConfig(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	var input map[string]interface{}
	if err := json.NewDecoder(c.Request().Body).Decode(&input); err != nil {
		return util.BadRequest(c, "invalid JSON body")
	}

	ctx := context.Background()
	mode := c.QueryParam("mode")

	var finalConfig map[string]interface{}

	if mode == "replace" {
		// Full replace
		finalConfig = input
	} else {
		// Merge mode (default): read existing, then merge input on top
		existing, err := k8s.ReadAgentRawConfig(ctx, agent.ID)
		if err != nil {
			return util.InternalError(c, "failed to read existing config: "+err.Error())
		}
		finalConfig = mergeMap(existing, input)
	}

	if err := k8s.WriteAgentRawConfig(ctx, agent.ID, finalConfig); err != nil {
		return util.InternalError(c, "failed to write config: "+err.Error())
	}

	return util.Success(c, finalConfig)
}

// mergeMap does a shallow merge of src into dst (src overwrites dst for top-level keys)
func mergeMap(dst, src map[string]interface{}) map[string]interface{} {
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
