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
	"github.com/spf13/viper"
)

type UpgradeAgentsRequest struct {
	Image string `json:"image"` // Target image, defaults to config value if empty
}

type UpgradeResult struct {
	AgentID string `json:"agent_id"`
	Status  string `json:"status"` // "upgraded", "failed", "skipped"
	Message string `json:"message,omitempty"`
}

type UpgradeAgentsResponse struct {
	Image    string          `json:"image"`
	Total    int             `json:"total"`
	Upgraded int64           `json:"upgraded"`
	Failed   int64           `json:"failed"`
	Skipped  int64           `json:"skipped"`
	Results  []UpgradeResult `json:"results"`
}

// UpgradeAgent upgrades a single agent's openclaw image
// POST /api/v1/admin/agents/:id/upgrade
func UpgradeAgent(c echo.Context) error {
	agentID := c.Param("id")
	if agentID == "" {
		return util.BadRequest(c, "agent id is required")
	}

	agent, err := model.GetAgentByID(agentID)
	if err != nil {
		return util.NotFound(c, "agent not found")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	var req UpgradeAgentsRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	image := req.Image
	if image == "" {
		image = viper.GetString("openclaw.image")
	}
	if image == "" {
		return util.BadRequest(c, "no image specified")
	}

	ctx := context.Background()

	// Check current image
	currentImage, _ := k8s.GetDeploymentImage(ctx, agent.ID)
	if currentImage == image {
		return util.Success(c, map[string]string{
			"status":  "skipped",
			"message": "already running target image",
			"image":   image,
		})
	}

	if err := k8s.UpdateDeploymentImage(ctx, agent.ID, image); err != nil {
		return util.InternalError(c, "failed to upgrade: "+err.Error())
	}

	// Sync config to new pod after image upgrade (applies latest gateway settings)
	go func() {
		if err := k8s.SyncConfigToPod(context.Background(), agent.ID); err != nil {
			fmt.Printf("[Upgrade] failed to sync config for agent %s: %v\n", agent.ID, err)
		}
	}()

	return util.Success(c, map[string]string{
		"status":         "upgraded",
		"image":          image,
		"previous_image": currentImage,
	})
}

// UpgradeAllAgents upgrades all running agents to a new openclaw image
// POST /api/v1/admin/agents/upgrade
func UpgradeAllAgents(c echo.Context) error {
	var req UpgradeAgentsRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	image := req.Image
	if image == "" {
		image = viper.GetString("openclaw.image")
	}
	if image == "" {
		return util.BadRequest(c, "no image specified")
	}

	agents, err := model.ListAgentsByStatus(model.AgentStatusRunning)
	if err != nil {
		return util.InternalError(c, "failed to list running agents")
	}

	if len(agents) == 0 {
		return util.Success(c, &UpgradeAgentsResponse{
			Image: image,
			Total: 0,
		})
	}

	ctx := context.Background()
	var upgraded, failed, skipped atomic.Int64
	results := make([]UpgradeResult, len(agents))

	// Upgrade concurrently with limited parallelism
	var wg sync.WaitGroup
	sem := make(chan struct{}, 10) // max 10 concurrent upgrades

	for i, agent := range agents {
		wg.Add(1)
		go func(idx int, a *model.Agent) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := UpgradeResult{AgentID: a.ID}

			// Check current image
			currentImage, err := k8s.GetDeploymentImage(ctx, a.ID)
			if err != nil {
				// Deployment might not exist, skip
				skipped.Add(1)
				result.Status = "skipped"
				result.Message = fmt.Sprintf("deployment not found: %v", err)
				results[idx] = result
				return
			}

			if currentImage == image {
				skipped.Add(1)
				result.Status = "skipped"
				result.Message = "already running target image"
				results[idx] = result
				return
			}

			if err := k8s.UpdateDeploymentImage(ctx, a.ID, image); err != nil {
				failed.Add(1)
				result.Status = "failed"
				result.Message = err.Error()
			} else {
				upgraded.Add(1)
				result.Status = "upgraded"
				// Sync config to new pod after image upgrade
				go func(agentID string) {
					if err := k8s.SyncConfigToPod(context.Background(), agentID); err != nil {
						fmt.Printf("[Upgrade] failed to sync config for agent %s: %v\n", agentID, err)
					}
				}(a.ID)
			}
			results[idx] = result
		}(i, agent)
	}

	wg.Wait()

	return util.Success(c, &UpgradeAgentsResponse{
		Image:    image,
		Total:    len(agents),
		Upgraded: upgraded.Load(),
		Failed:   failed.Load(),
		Skipped:  skipped.Load(),
		Results:  results,
	})
}
