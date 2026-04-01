package cmd

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cleanupCmd = &cobra.Command{
	Use:   "cleanup",
	Short: "Stop expired agents and clean up K8s resources",
	Run: func(cmd *cobra.Command, args []string) {
		if err := initConfigLight(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}
		if err := k8s.InitClient(); err != nil {
			log.Fatalf("init k8s client failed: %v", err)
		}

		graceHours := viper.GetInt("bot.cleanup_grace_hours")
		if graceHours <= 0 {
			graceHours = 72
		}
		batchSize := viper.GetInt("bot.cleanup_batch_size")
		if batchSize <= 0 {
			batchSize = 50
		}
		grace := time.Duration(graceHours) * time.Hour

		log.Printf("[cleanup] starting, grace=%dh, batch=%d", graceHours, batchSize)
		cleanupExpiredAgents(grace, batchSize)
		log.Printf("[cleanup] done")
	},
}

func init() {
	rootCmd.AddCommand(cleanupCmd)
}

func cleanupExpiredAgents(grace time.Duration, limit int) {
	agents, err := model.ListExpiredAgents(grace, limit)
	if err != nil {
		log.Printf("[cleanup] failed to list expired agents: %v", err)
		return
	}
	if len(agents) == 0 {
		log.Printf("[cleanup] no expired agents found")
		return
	}

	log.Printf("[cleanup] found %d expired agent(s)", len(agents))

	// Process concurrently with limited parallelism
	concurrency := 10
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	for _, agent := range agents {
		wg.Add(1)
		sem <- struct{}{} // acquire
		go func(agent *model.Agent) {
			defer wg.Done()
			defer func() { <-sem }() // release

			log.Printf("[cleanup] removing agent %s (%s), status=%s, expired at %s",
				agent.ID, agent.Name, agent.Status, agent.ExpiresAt.Format(time.RFC3339))

			ctx := context.Background()
			k8s.DeleteDeployment(ctx, agent.ID)
			k8s.DeleteService(ctx, agent.ID)

			if err := model.UpdateAgentStatus(agent.ID, model.AgentStatusDeleted, ""); err != nil {
				log.Printf("[cleanup] failed to mark agent %s as deleted: %v", agent.ID, err)
				return
			}

			log.Printf("[cleanup] agent %s done", agent.ID)
		}(agent)
	}

	wg.Wait()
}
