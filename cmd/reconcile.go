package cmd

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/spf13/cobra"
)

var reconcileCmd = &cobra.Command{
	Use:   "reconcile",
	Short: "Sync agent status in DB with actual K8s state",
	Run: func(cmd *cobra.Command, args []string) {
		if err := initConfigLight(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}
		if err := k8s.InitClient(); err != nil {
			log.Fatalf("init k8s client failed: %v", err)
		}

		log.Printf("[reconcile] starting")
		reconcileAgentStatus()
		log.Printf("[reconcile] done")
	},
}

func init() {
	rootCmd.AddCommand(reconcileCmd)
}

const startingTimeout = 10 * time.Minute

func reconcileAgentStatus() {
	// Phase 1: Check agents that DB thinks are active
	running, _ := model.ListAgentsByStatus(model.AgentStatusRunning)
	starting, _ := model.ListAgentsByStatus(model.AgentStatusStarting)
	activeAgents := append(running, starting...)

	// Phase 2: Check agents that DB thinks are inactive but K8s might still have resources
	stopped, _ := model.ListAgentsByStatus(model.AgentStatusStopped)
	errored, _ := model.ListAgentsByStatus(model.AgentStatusError)
	inactiveAgents := append(stopped, errored...)

	total := len(activeAgents) + len(inactiveAgents)
	if total == 0 {
		log.Printf("[reconcile] no agents to check")
		return
	}

	ctx := context.Background()
	concurrency := 10
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var fixed atomic.Int64

	// Phase 1: active agents — check if K8s matches DB
	if len(activeAgents) > 0 {
		log.Printf("[reconcile] checking %d active agent(s)", len(activeAgents))
		for _, agent := range activeAgents {
			wg.Add(1)
			sem <- struct{}{}
			go func(agent *model.Agent) {
				defer wg.Done()
				defer func() { <-sem }()

				info, err := k8s.GetDeploymentStatusInfo(ctx, agent.ID)
				if err != nil {
					log.Printf("[reconcile] failed to check agent %s: %v", agent.ID, err)
					return
				}

				switch {
				case info.Status == "not_found":
					log.Printf("[reconcile] agent %s (%s): deployment not found, %s -> stopped",
						agent.ID, agent.Name, agent.Status)
					model.UpdateAgentStatus(agent.ID, model.AgentStatusStopped, "")
					k8s.DeleteService(ctx, agent.ID)
					fixed.Add(1)

				case info.ReadyReplicas > 0 && agent.Status == model.AgentStatusStarting:
					log.Printf("[reconcile] agent %s (%s): pod ready, starting -> running",
						agent.ID, agent.Name)
					model.UpdateAgentStatus(agent.ID, model.AgentStatusRunning, agent.Endpoint)
					fixed.Add(1)

				case info.ReadyReplicas == 0 && agent.Status == model.AgentStatusStarting &&
					time.Since(agent.UpdatedAt) > startingTimeout:
					log.Printf("[reconcile] agent %s (%s): stuck starting for %s, cleaning up",
						agent.ID, agent.Name, time.Since(agent.UpdatedAt).Round(time.Second))
					k8s.DeleteDeployment(ctx, agent.ID)
					k8s.DeleteService(ctx, agent.ID)
					model.UpdateAgentStatus(agent.ID, model.AgentStatusError, "")
					fixed.Add(1)

				case info.ReadyReplicas == 0 && agent.Status == model.AgentStatusRunning:
					log.Printf("[reconcile] agent %s (%s): no ready pods, running -> stopped",
						agent.ID, agent.Name)
					k8s.DeleteDeployment(ctx, agent.ID)
					k8s.DeleteService(ctx, agent.ID)
					model.UpdateAgentStatus(agent.ID, model.AgentStatusStopped, "")
					fixed.Add(1)
				}
			}(agent)
		}
		wg.Wait()
	}

	// Phase 2: inactive agents — clean up orphaned K8s resources
	if len(inactiveAgents) > 0 {
		log.Printf("[reconcile] checking %d inactive agent(s) for orphaned resources", len(inactiveAgents))
		for _, agent := range inactiveAgents {
			wg.Add(1)
			sem <- struct{}{}
			go func(agent *model.Agent) {
				defer wg.Done()
				defer func() { <-sem }()

				exists, err := k8s.GetDeploymentStatus(ctx, agent.ID)
				if err != nil {
					return // can't check, skip
				}
				// exists returns true if readyReplicas > 0, but we also need
				// to catch deployments with 0 ready replicas (CrashLoopBackOff etc.)
				// So check if deployment exists at all via GetDeploymentStatusInfo
				info, err := k8s.GetDeploymentStatusInfo(ctx, agent.ID)
				if err != nil || info.Status == "not_found" {
					return // no K8s resources, nothing to clean
				}
				_ = exists

				log.Printf("[reconcile] agent %s (%s): DB=%s but K8s deployment exists (ready=%d), cleaning up",
					agent.ID, agent.Name, agent.Status, info.ReadyReplicas)
				k8s.DeleteDeployment(ctx, agent.ID)
				k8s.DeleteService(ctx, agent.ID)
				fixed.Add(1)
			}(agent)
		}
		wg.Wait()
	}

	log.Printf("[reconcile] fixed %d agent(s)", fixed.Load())
}
