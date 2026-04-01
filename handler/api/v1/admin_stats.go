package v1

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func GetStats(c echo.Context) error {
	userCount, _ := model.CountUsers()
	agentCount, _ := model.CountAgents()
	runningCount, _ := model.CountAgentsByStatus(model.AgentStatusRunning)

	return util.Success(c, map[string]interface{}{
		"users":          userCount,
		"agents":         agentCount,
		"running_agents": runningCount,
	})
}

func ListAllAgentsAdmin(c echo.Context) error {
	var agents []*model.Agent
	if err := util.GetDB().Order("created_at DESC").Find(&agents).Error; err != nil {
		return util.InternalError(c, "failed to list agents")
	}
	return util.Success(c, agents)
}
