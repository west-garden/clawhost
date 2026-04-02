package v1

import (
	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func ListAgents(c echo.Context) error {
	// Get user_id from JWT claims
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}

	agents, err := model.ListAgentsByUserID(claims.UserID)
	if err != nil {
		return util.InternalError(c, "failed to list agents")
	}

	return util.Success(c, agents)
}
