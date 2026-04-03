package middleware

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

const (
	ContextKeyAgent = "authorized_agent"
)

// AgentOwnerAuth validates that the JWT-authenticated user owns the agent
// identified by the ":id" path parameter.
// Must be used after JWTAuth middleware.
func AgentOwnerAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			agentID := c.Param("id")
			if agentID == "" {
				return util.BadRequest(c, "agent id is required")
			}

			agent, err := model.GetAgentByID(agentID)
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
