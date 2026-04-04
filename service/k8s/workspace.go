package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

const openclawHome = "/home/node/.openclaw"

// workspacePath returns the workspace directory path for an agent.
// Default agent ("main" or empty) uses "workspace", others use "workspace-{agentId}".
func workspacePath(agentID string) string {
	if agentID == "" || agentID == "main" {
		return openclawHome + "/workspace"
	}
	return fmt.Sprintf("%s/workspace-%s", openclawHome, agentID)
}

// ListAgents returns the agent list from openclaw.json config
func ListAgents(ctx context.Context, botID string) ([]map[string]interface{}, error) {
	config, err := ReadAgentRawConfig(ctx, botID)
	if err != nil {
		return nil, err
	}

	agents, ok := config["agents"].(map[string]interface{})
	if !ok {
		return nil, nil
	}

	list, ok := agents["list"].([]interface{})
	if !ok {
		// Return default agent if no list
		return []map[string]interface{}{
			{"id": "main", "name": "Default"},
		}, nil
	}

	result := make([]map[string]interface{}, 0, len(list))
	for _, a := range list {
		if m, ok := a.(map[string]interface{}); ok {
			result = append(result, m)
		}
	}

	// Always include main agent
	hasMain := false
	for _, a := range result {
		if a["id"] == "main" {
			hasMain = true
			break
		}
	}
	if !hasMain {
		result = append([]map[string]interface{}{{"id": "main", "name": "Default"}}, result...)
	}

	return result, nil
}

// ReadWorkspaceFile reads a file from an agent's workspace
func ReadWorkspaceFile(ctx context.Context, botID, agentID, filename string) (string, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return "", fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/%s", workspacePath(agentID), filename)
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("cat '%s' 2>/dev/null || echo ''", filePath)})
	if err != nil {
		return "", err
	}
	return output, nil
}

// WriteWorkspaceFile writes a file to an agent's workspace
func WriteWorkspaceFile(ctx context.Context, botID, agentID, filename, content string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	dir := workspacePath(agentID)
	filePath := fmt.Sprintf("%s/%s", dir, filename)

	// Ensure directory exists and write file
	cmd := fmt.Sprintf("mkdir -p '%s' && cat > '%s' << 'EOFCONTENT'\n%s\nEOFCONTENT", dir, filePath, content)
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", cmd})
	return err
}

// ListWorkspaceFiles lists all .md files in an agent's workspace
func ListWorkspaceFiles(ctx context.Context, botID, agentID string) ([]string, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	dir := workspacePath(agentID)
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("ls '%s'/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ''", dir)})
	if err != nil {
		return nil, err
	}

	files := []string{}
	for _, f := range strings.Split(strings.TrimSpace(output), "\n") {
		if f != "" {
			files = append(files, f)
		}
	}
	return files, nil
}

// ListSkills lists skill directories for an agent
// Returns skill names (directory names in skills/)
func ListSkills(ctx context.Context, botID, agentID string) ([]map[string]string, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	// Skills are in workspace/.openclaw/skills/{skillName}/SKILL.md
	skillsDir := fmt.Sprintf("%s/.openclaw/skills", workspacePath(agentID))
	// List directories (skill names) that contain SKILL.md
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("ls -d '%s'/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ''", skillsDir)})
	if err != nil {
		return nil, err
	}

	skills := []map[string]string{}
	for _, f := range strings.Split(strings.TrimSpace(output), "\n") {
		if f != "" {
			name := strings.TrimSuffix(f, "/")
			skills = append(skills, map[string]string{"name": name, "filename": name})
		}
	}
	return skills, nil
}

// ReadSkill reads a skill file content
// Uses directory structure: skills/{skillName}/SKILL.md
func ReadSkill(ctx context.Context, botID, agentID, skillName string) (string, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return "", fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/.openclaw/skills/%s/SKILL.md", workspacePath(agentID), skillName)
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("cat '%s' 2>/dev/null || echo ''", filePath)})
	if err != nil {
		return "", err
	}
	return output, nil
}

// WriteSkill writes a skill file
// Uses directory structure: skills/{skillName}/SKILL.md
func WriteSkill(ctx context.Context, botID, agentID, skillName, content string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	// Skills are in workspace/.openclaw/skills/{skillName}/SKILL.md
	skillsDir := fmt.Sprintf("%s/.openclaw/skills/%s", workspacePath(agentID), skillName)
	filePath := fmt.Sprintf("%s/SKILL.md", skillsDir)
	cmd := fmt.Sprintf("mkdir -p '%s' && cat > '%s' << 'EOFCONTENT'\n%s\nEOFCONTENT", skillsDir, filePath, content)
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", cmd})
	return err
}

// DeleteSkill deletes a skill directory
// Uses directory structure: skills/{skillName}/
func DeleteSkill(ctx context.Context, botID, agentID, skillName string) error {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	// Delete the entire skill directory (includes SKILL.md and _meta.json)
	skillDir := fmt.Sprintf("%s/.openclaw/skills/%s", workspacePath(agentID), skillName)
	_, err = ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("rm -rf '%s'", skillDir)})
	return err
}

// ReadAgentConfig reads the agent-specific config (models.json etc.)
func ReadAgentConfig(ctx context.Context, botID, agentID string) (map[string]interface{}, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/agents/%s/agent/models.json", openclawHome, agentID)
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("cat '%s' 2>/dev/null || echo '{}'", filePath)})
	if err != nil {
		return nil, err
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(output), &config); err != nil {
		return nil, err
	}
	return config, nil
}
