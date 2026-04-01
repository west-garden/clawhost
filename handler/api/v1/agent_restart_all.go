package v1

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type RestartResult struct {
	AgentID string `json:"agent_id"`
	Status  string `json:"status"` // "restarted", "failed", "skipped"
	Message string `json:"message,omitempty"`
}

// RestartAllAgents restarts all running agents with full pod spec rebuild.
// Executes asynchronously -- returns immediately with the total count,
// agents are restarted in the background.
// POST /api/v1/admin/agents/restart
func RestartAllAgents(c echo.Context) error {
	agents, err := model.ListAgentsByStatus(model.AgentStatusRunning)
	if err != nil {
		return util.InternalError(c, "failed to list running agents")
	}

	if len(agents) == 0 {
		return util.Success(c, map[string]interface{}{
			"total":   0,
			"message": "no running agents to restart",
		})
	}

	// Launch restart in background
	go restartAgentsAsync(agents)

	return util.Success(c, map[string]interface{}{
		"total":   len(agents),
		"message": "restart initiated in background",
	})
}

func restartAgentsAsync(agents []*model.Agent) {
	ctx := context.Background()
	var restarted, failed, skipped atomic.Int64

	var wg sync.WaitGroup
	sem := make(chan struct{}, 1) // sequential restarts to avoid node memory pressure

	for _, agent := range agents {
		wg.Add(1)
		go func(a *model.Agent) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// Check deployment exists
			exists, err := k8s.DeploymentExists(ctx, a.ID)
			if err != nil || !exists {
				skipped.Add(1)
				fmt.Printf("[RestartAll] Skipped agent %s: deployment not found\n", a.ID)
				return
			}

			// Build config and replace deployment
			openclawConfig, _ := a.GetOpenClawConfig()
			k8sConfig := convertToK8sConfig(a, openclawConfig)

			if err := k8s.ReplaceDeployment(ctx, a.ID, a.UserID, a.AccessToken, k8sConfig); err != nil {
				failed.Add(1)
				fmt.Printf("[RestartAll] Failed agent %s: %v\n", a.ID, err)
				return
			}

			// Recreate service for port changes
			k8s.DeleteService(ctx, a.ID)
			endpoint, err := k8s.CreateService(ctx, a.ID, a.UserID)
			if err != nil {
				failed.Add(1)
				fmt.Printf("[RestartAll] Service failed for agent %s: %v\n", a.ID, err)
				return
			}

			_ = model.UpdateAgentStatus(a.ID, model.AgentStatusRunning, endpoint)

			// Sync config to pod after restart (ensures controlUi, http, etc.)
			if k8sConfig.AccessToken != "" {
				if err := k8s.WriteConfigToBot(ctx, a.ID, k8sConfig, false); err != nil {
					fmt.Printf("[RestartAll] Config sync failed for agent %s: %v\n", a.ID, err)
				}
			}

			restarted.Add(1)
			fmt.Printf("[RestartAll] Restarted agent %s\n", a.ID)
		}(agent)
	}

	wg.Wait()
	fmt.Printf("[RestartAll] Done: %d restarted, %d failed, %d skipped (total %d)\n",
		restarted.Load(), failed.Load(), skipped.Load(), len(agents))
}
