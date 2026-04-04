package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/service/skills"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type InstallMarketplaceRequest struct {
	SkillName string `json:"skill_name" validate:"required"`
}

// InstallMarketplaceSkill installs a skill from the marketplace
func InstallMarketplaceSkill(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running, cannot install skills")
	}

	var req InstallMarketplaceRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.SkillName == "" {
		return util.BadRequest(c, "skill_name is required")
	}

	// Find skill in index to get path
	index, err := defaultFetcher.FetchIndex()
	if err != nil {
		return util.InternalError(c, "failed to fetch marketplace: "+err.Error())
	}

	var skillPath string
	for _, skill := range index.Skills {
		if skill.Name == req.SkillName || skill.Path == req.SkillName {
			skillPath = skill.Path
			break
		}
	}

	if skillPath == "" {
		return util.BadRequest(c, "skill not found in marketplace")
	}

	ctx := context.Background()

	// Fetch skill content
	content, err := defaultFetcher.FetchSkillContent(skillPath)
	if err != nil {
		return util.InternalError(c, "failed to fetch skill content: "+err.Error())
	}

	// Fetch skill meta
	metaRaw, err := defaultFetcher.FetchSkillMeta(skillPath)
	if err != nil {
		// Non-critical, we'll extract from content
		metaRaw = nil
	}

	// Write skill to pod
	if err := k8s.WriteSkill(ctx, agent.ID, "main", skillPath, content); err != nil {
		return util.InternalError(c, "failed to write skill: "+err.Error())
	}

	// Write metadata
	meta := &skills.SkillMeta{}
	if metaRaw != nil {
		if name, ok := metaRaw["name"].(string); ok {
			meta.Name = name
		}
		if desc, ok := metaRaw["description"].(string); ok {
			meta.Description = desc
		}
		if author, ok := metaRaw["author"].(string); ok {
			meta.Author = author
		}
		if version, ok := metaRaw["version"].(string); ok {
			meta.Version = version
		}
	}
	meta.Source = "marketplace"

	// Also try to extract from content as backup
	contentMeta := extractMetaFromContent(content)
	if meta.Name == "" && contentMeta.Name != "" {
		meta.Name = contentMeta.Name
	}
	if meta.Description == "" && contentMeta.Description != "" {
		meta.Description = contentMeta.Description
	}
	if meta.Author == "" && contentMeta.Author != "" {
		meta.Author = contentMeta.Author
	}
	if meta.Version == "" && contentMeta.Version != "" {
		meta.Version = contentMeta.Version
	}

	if err := skills.WriteSkillMeta(ctx, agent.ID, "main", skillPath, meta); err != nil {
		// Non-critical error
	}

	return util.Success(c, map[string]interface{}{
		"name":      skillPath,
		"installed": true,
	})
}