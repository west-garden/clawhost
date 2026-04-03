package k8s

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const openclawHome = "/home/node/.openclaw"

var (
	// Valid filename: alphanumeric, dashes, underscores, dots (no path traversal)
	validFilenameRegex = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	// Valid skill name: lowercase alphanumeric, dashes, underscores
	validSkillNameRegex = regexp.MustCompile(`^[a-z0-9_-]+$`)
)

// validateFilename checks for path traversal and invalid characters
func validateFilename(filename string) error {
	if filename == "" {
		return errors.New("filename is required")
	}
	if len(filename) > 255 {
		return errors.New("filename too long")
	}
	if strings.Contains(filename, "..") {
		return errors.New("invalid filename: path traversal not allowed")
	}
	if strings.ContainsAny(filename, "/\\") {
		return errors.New("invalid filename: path separators not allowed")
	}
	if !validFilenameRegex.MatchString(filename) {
		return errors.New("invalid filename: only alphanumeric, dots, dashes, and underscores allowed")
	}
	return nil
}

// validateSkillName checks for valid skill name format
func validateSkillName(name string) error {
	if name == "" {
		return errors.New("skill name is required")
	}
	if len(name) > 100 {
		return errors.New("skill name too long")
	}
	if !validSkillNameRegex.MatchString(name) {
		return errors.New("invalid skill name: only lowercase alphanumeric, dashes, and underscores allowed")
	}
	return nil
}

// validateAgentID checks for valid agent ID format (alphanumeric, dashes, underscores)
func validateAgentID(agentID string) error {
	if agentID == "" || agentID == "main" {
		return nil
	}
	if len(agentID) > 100 {
		return errors.New("agent ID too long")
	}
	if strings.ContainsAny(agentID, "./\\") {
		return errors.New("invalid agent ID")
	}
	return nil
}

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
	if err := validateAgentID(agentID); err != nil {
		return "", err
	}
	if err := validateFilename(filename); err != nil {
		return "", err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return "", fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/%s", workspacePath(agentID), filename)
	// Use safe path without shell interpolation
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", filePath})
	if err != nil {
		// File doesn't exist or other error
		return "", nil
	}
	return output, nil
}

// WriteWorkspaceFile writes a file to an agent's workspace
func WriteWorkspaceFile(ctx context.Context, botID, agentID, filename, content string) error {
	if err := validateAgentID(agentID); err != nil {
		return err
	}
	if err := validateFilename(filename); err != nil {
		return err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	dir := workspacePath(agentID)
	filePath := fmt.Sprintf("%s/%s", dir, filename)

	// Use base64 encoding to avoid shell injection via content
	contentB64 := base64.StdEncoding.EncodeToString([]byte(content))
	// Use node to decode base64 and write file (avoids shell escaping issues)
	script := fmt.Sprintf(
		`const fs=require('fs');fs.mkdirSync('%s',{recursive:true});fs.writeFileSync('%s',Buffer.from('%s','base64').toString());`,
		dir, filePath, contentB64)

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"node", "-e", script})
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

// ListSkills lists skill files for an agent
func ListSkills(ctx context.Context, botID, agentID string) ([]map[string]string, error) {
	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	// Skills are in workspace/.openclaw/skills/
	skillsDir := fmt.Sprintf("%s/.openclaw/skills", workspacePath(agentID))
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("ls '%s'/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ''", skillsDir)})
	if err != nil {
		return nil, err
	}

	skills := []map[string]string{}
	for _, f := range strings.Split(strings.TrimSpace(output), "\n") {
		if f != "" {
			name := strings.TrimSuffix(f, ".md")
			skills = append(skills, map[string]string{"name": name, "filename": f})
		}
	}
	return skills, nil
}

// ReadSkill reads a skill file content
func ReadSkill(ctx context.Context, botID, agentID, skillName string) (string, error) {
	if err := validateAgentID(agentID); err != nil {
		return "", err
	}
	if err := validateSkillName(skillName); err != nil {
		return "", err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return "", fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/.openclaw/skills/%s.md", workspacePath(agentID), skillName)
	// Use safe path without shell interpolation
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", filePath})
	if err != nil {
		return "", nil
	}
	return output, nil
}

// WriteSkill writes a skill file
func WriteSkill(ctx context.Context, botID, agentID, skillName, content string) error {
	if err := validateAgentID(agentID); err != nil {
		return err
	}
	if err := validateSkillName(skillName); err != nil {
		return err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	skillsDir := fmt.Sprintf("%s/.openclaw/skills", workspacePath(agentID))
	filePath := fmt.Sprintf("%s/%s.md", skillsDir, skillName)

	// Use base64 encoding to avoid shell injection via content
	contentB64 := base64.StdEncoding.EncodeToString([]byte(content))
	// Use node to decode base64 and write file (avoids shell escaping issues)
	script := fmt.Sprintf(
		`const fs=require('fs');fs.mkdirSync('%s',{recursive:true});fs.writeFileSync('%s',Buffer.from('%s','base64').toString());`,
		skillsDir, filePath, contentB64)

	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"node", "-e", script})
	return err
}

// DeleteSkill deletes a skill file
func DeleteSkill(ctx context.Context, botID, agentID, skillName string) error {
	if err := validateAgentID(agentID); err != nil {
		return err
	}
	if err := validateSkillName(skillName); err != nil {
		return err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/.openclaw/skills/%s.md", workspacePath(agentID), skillName)
	// Use safe path without shell interpolation
	_, err = ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"rm", "-f", filePath})
	return err
}

// ReadAgentConfig reads the agent-specific config (models.json etc.)
func ReadAgentConfig(ctx context.Context, botID, agentID string) (map[string]interface{}, error) {
	if err := validateAgentID(agentID); err != nil {
		return nil, err
	}

	namespace := GetNamespace()
	podName, err := WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	filePath := fmt.Sprintf("%s/agents/%s/agent/models.json", openclawHome, agentID)
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", filePath})
	if err != nil {
		return map[string]interface{}{}, nil
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(output), &config); err != nil {
		return nil, err
	}
	return config, nil
}
