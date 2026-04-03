package middleware

import (
	"regexp"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

const (
	ContextKeyAgent = "authorized_agent"
)

// UUID format regex
var uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// isUUID checks if a string is in UUID format
func isUUID(s string) bool {
	return uuidRegex.MatchString(s)
}

// AgentOwnerAuth validates that the JWT-authenticated user owns the agent
// identified by the ":id" path parameter.
// Supports both UUID (agent.ID) and slug (agent.Slug) lookup.
// Must be used after JWTAuth middleware.
func AgentOwnerAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			agentID := c.Param("id")
			if agentID == "" {
				return util.BadRequest(c, "agent id is required")
			}

			// Lookup by UUID or slug (same logic as proxy layer)
			var agent *model.Agent
			var err error
			if isUUID(agentID) {
				agent, err = model.GetAgentByID(agentID)
			} else {
				agent, err = model.GetAgentBySlug(agentID)
			}
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return util.NotFound(c, "agent not found")
				}
				return util.InternalError(c, "failed to get agent")
			}

			// Verify ownership via JWT claims
			claims := GetUserClaimsFromContext(c)
			if claims != nil {
				if agent.UserID != claims.UserID {
					return util.Forbidden(c, "not authorized to access this agent")
				}
			}

			c.Set(ContextKeyAgent, agent)
			return next(c)
		}
	}
}

// GetAgentFromContext retrieves the authorized agent from the request context.
func GetAgentFromContext(c echo.Context) *model.Agent {
	agent, ok := c.Get(ContextKeyAgent).(*model.Agent)
	if !ok {
		return nil
	}
	return agent
}
