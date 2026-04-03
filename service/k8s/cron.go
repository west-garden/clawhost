package k8s

import (
	"context"
	"encoding/json"
	"fmt"
)

// CronJob represents a cron job
type CronJob struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Schedule string `json:"schedule"`
	Timezone string `json:"timezone"`
	Enabled  bool   `json:"enabled"`
	LastRun  string `json:"lastRun,omitempty"`
	NextRun  string `json:"nextRun,omitempty"`
}

// ListCronJobs lists all cron jobs for an agent
func ListCronJobs(ctx context.Context, botID string) ([]CronJob, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	// Execute openclaw cron list --json
	output, err := ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "list", "--json"})
	if err != nil {
		// If command fails, return empty list (cron might not be configured)
		return []CronJob{}, nil
	}

	var jobs []CronJob
	if err := json.Unmarshal([]byte(output), &jobs); err != nil {
		// Try parsing as map with "jobs" key
		var result struct {
			Jobs []CronJob `json:"jobs"`
		}
		if err := json.Unmarshal([]byte(output), &result); err != nil {
			return []CronJob{}, nil
		}
		return result.Jobs, nil
	}

	return jobs, nil
}

// RunCronJob triggers a cron job to run immediately
func RunCronJob(ctx context.Context, botID, jobID string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "run", jobID})
	return err
}

// DeleteCronJob deletes a cron job
func DeleteCronJob(ctx context.Context, botID, jobID string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "remove", jobID})
	return err
}

// ToggleCronJob enables or disables a cron job
func ToggleCronJob(ctx context.Context, botID, jobID string, enabled bool) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	// Try using CLI first
	enabledStr := "true"
	if !enabled {
		enabledStr = "false"
	}
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"cron", "edit", jobID, "--enabled", enabledStr})
	if err == nil {
		return nil
	}

	// Fallback: directly modify jobs.json
	return toggleCronJobInFile(ctx, namespace, podName, jobID, enabled)
}

func toggleCronJobInFile(ctx context.Context, namespace, podName, jobID string, enabled bool) error {
	// Read jobs.json
	output, err := ExecInPod(ctx, namespace, podName, "sh", []string{"-c", "cat /home/node/.openclaw/cron/jobs.json 2>/dev/null || echo '{}'"})
	if err != nil {
		return fmt.Errorf("failed to read jobs.json: %w", err)
	}

	var jobsData map[string]interface{}
	if err := json.Unmarshal([]byte(output), &jobsData); err != nil {
		return fmt.Errorf("failed to parse jobs.json: %w", err)
	}

	// Find and update the job
	jobs, ok := jobsData["jobs"].([]interface{})
	if !ok {
		return fmt.Errorf("invalid jobs.json format")
	}

	for i, j := range jobs {
		if job, ok := j.(map[string]interface{}); ok {
			if job["id"] == jobID {
				job["enabled"] = enabled
				jobs[i] = job
				break
			}
		}
	}

	// Write back
	updatedJSON, err := json.Marshal(jobsData)
	if err != nil {
		return fmt.Errorf("failed to marshal jobs.json: %w", err)
	}

	// Use heredoc to write file
	cmd := fmt.Sprintf("cat > /home/node/.openclaw/cron/jobs.json << 'EOFJSON'\n%s\nEOFJSON", string(updatedJSON))
	_, err = ExecInPod(ctx, namespace, podName, "sh", []string{"-c", cmd})
	return err
}
