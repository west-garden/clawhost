package skills

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/clawhost/clawhost/service/k8s"
)

const (
	// MetaFileName is the name of the metadata file
	MetaFileName = "_meta.json"
)

// SkillMeta represents skill metadata
type SkillMeta struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
	InstalledAt int64  `json:"installedAt,omitempty"`
	Source      string `json:"source,omitempty"` // github, zip, manual
}

// SkillWithMeta represents a skill with its metadata
type SkillWithMeta struct {
	Name        string `json:"name"`
	NameDisplay string `json:"name_display,omitempty"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
	InstalledAt int64  `json:"installedAt,omitempty"`
	Source      string `json:"source,omitempty"`
}

// ReadSkillMeta reads skill metadata from pod
func ReadSkillMeta(ctx context.Context, botID, agentID, skillName string) (*SkillMeta, error) {
	namespace := k8s.GetNamespace()
	podName, err := k8s.WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	// Skills are in /home/node/.openclaw/workspace/.openclaw/skills/ or /app/.openclaw/workspace/skills/
	skillDir := getSkillDir(agentID)
	metaPath := fmt.Sprintf("%s/%s/%s", skillDir, skillName, MetaFileName)

	output, err := k8s.ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("cat '%s' 2>/dev/null || echo '{}'", metaPath)})
	if err != nil {
		return nil, err
	}

	var meta SkillMeta
	if err := json.Unmarshal([]byte(output), &meta); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	return &meta, nil
}

// WriteSkillMeta writes skill metadata to pod
func WriteSkillMeta(ctx context.Context, botID, agentID, skillName string, meta *SkillMeta) error {
	namespace := k8s.GetNamespace()
	podName, err := k8s.WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	if meta.InstalledAt == 0 {
		meta.InstalledAt = time.Now().Unix()
	}

	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	skillDir := getSkillDir(agentID)
	metaPath := fmt.Sprintf("%s/%s/%s", skillDir, skillName, MetaFileName)

	// Ensure directory exists and write metadata
	cmd := fmt.Sprintf("mkdir -p '%s/%s' && cat > '%s' << 'EOFMETA'\n%s\nEOFMETA",
		skillDir, skillName, metaPath, string(metaJSON))
	_, err = k8s.ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", cmd})
	return err
}

// DeleteSkillMeta deletes skill metadata from pod
func DeleteSkillMeta(ctx context.Context, botID, agentID, skillName string) error {
	namespace := k8s.GetNamespace()
	podName, err := k8s.WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return fmt.Errorf("pod not ready: %w", err)
	}

	skillDir := getSkillDir(agentID)
	metaPath := fmt.Sprintf("%s/%s/%s", skillDir, skillName, MetaFileName)

	_, err = k8s.ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("rm -f '%s'", metaPath)})
	return err
}

// ListSkillsWithMeta lists all skills with their metadata
// Supports both simple skills (skills/{name}/SKILL.md) and nested skills (skills/{pack}/{sub}/SKILL.md)
func ListSkillsWithMeta(ctx context.Context, botID, agentID string) ([]SkillWithMeta, error) {
	namespace := k8s.GetNamespace()
	podName, err := k8s.WaitForPodReady(ctx, botID, 10)
	if err != nil {
		return nil, fmt.Errorf("pod not ready: %w", err)
	}

	skillDir := getSkillDir(agentID)

	// Find all SKILL.md files recursively to support skill packs
	findCmd := fmt.Sprintf("find '%s' -name 'SKILL.md' -type f 2>/dev/null | sed 's|^%s/||' | sed 's|/SKILL.md$||'", skillDir, skillDir)
	output, err := k8s.ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", findCmd})
	if err != nil {
		return nil, err
	}

	var skills []SkillWithMeta
	for _, name := range splitLines(output) {
		if name == "" {
			continue
		}

		skill := SkillWithMeta{Name: name}

		// Try to read metadata
		meta, err := ReadSkillMeta(ctx, botID, agentID, name)
		if err == nil && meta != nil {
			skill.NameDisplay = meta.Name
			skill.Description = meta.Description
			skill.Author = meta.Author
			skill.Version = meta.Version
			skill.InstalledAt = meta.InstalledAt
			skill.Source = meta.Source
		}

		// If no display name from meta, try to extract from skill content
		if skill.NameDisplay == "" {
			displayName, err := extractSkillNameFromContent(ctx, namespace, podName, skillDir, name)
			if err == nil && displayName != "" {
				skill.NameDisplay = displayName
			} else {
				// Use the skill folder name as display name
				skill.NameDisplay = name
			}
		}

		skills = append(skills, skill)
	}

	return skills, nil
}

// extractSkillNameFromContent extracts the display name from skill markdown frontmatter
func extractSkillNameFromContent(ctx context.Context, namespace, podName, skillDir, skillName string) (string, error) {
	// Skill file is at skills/{skillName}/SKILL.md
	mdPath := fmt.Sprintf("%s/%s/SKILL.md", skillDir, skillName)
	output, err := k8s.ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"sh", "-c", fmt.Sprintf("head -20 '%s' 2>/dev/null | grep -m1 '^name:' | sed 's/name: *//' || echo ''", mdPath)})
	if err != nil {
		return "", err
	}
	return trimLine(output), nil
}

// getSkillDir returns the skill directory path for an agent
func getSkillDir(agentID string) string {
	if agentID == "" || agentID == "main" {
		return "/home/node/.openclaw/workspace/.openclaw/skills"
	}
	return fmt.Sprintf("/home/node/.openclaw/workspace-%s/.openclaw/skills", agentID)
}

// splitLines splits output into lines
func splitLines(s string) []string {
	var lines []string
	for _, line := range splitSlice(s) {
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func splitSlice(s string) []string {
	if s == "" {
		return nil
	}
	result := make([]string, 0)
	for _, line := range split(s, "\n") {
		result = append(result, line)
	}
	return result
}

func split(s, sep string) []string {
	if s == "" {
		return nil
	}
	if sep == "" {
		return []string{s}
	}
	result := make([]string, 0)
	i := 0
	for {
		j := indexOf(s, sep, i)
		if j < 0 {
			result = append(result, s[i:])
			break
		}
		result = append(result, s[i:j])
		i = j + len(sep)
	}
	return result
}

func indexOf(s, sep string, from int) int {
	for i := from; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			return i
		}
	}
	return -1
}

func trimLine(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t' || s[0] == '\n' || s[0] == '\r') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t' || s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}