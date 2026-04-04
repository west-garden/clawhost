package v1

import (
	"context"
	"fmt"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/service/marketplace"
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

	var skillListing *marketplace.SkillListing
	for i := range index.Skills {
		if index.Skills[i].Name == req.SkillName || index.Skills[i].Path == req.SkillName {
			skillListing = &index.Skills[i]
			break
		}
	}

	if skillListing == nil {
		return util.BadRequest(c, "skill not found in marketplace")
	}

	ctx := context.Background()

	// Check if this is a skill pack (has sub-skills)
	if len(skillListing.Skills) > 0 {
		// Install each sub-skill
		installedSkills := []string{}
		for _, subSkillName := range skillListing.Skills {
			content, err := defaultFetcher.FetchSubSkillContent(skillListing.Path, subSkillName)
			if err != nil {
				// Skip sub-skills that don't have content files
				continue
			}

			// Write sub-skill to pod with path like "superpowers/using-superpowers"
			subSkillPath := fmt.Sprintf("%s/%s", skillListing.Path, subSkillName)
			if err := k8s.WriteSkill(ctx, agent.ID, "main", subSkillPath, content); err != nil {
				return util.InternalError(c, "failed to write sub-skill "+subSkillName+": "+err.Error())
			}

			// Write metadata for sub-skill
			meta := &skills.SkillMeta{
				Name:        subSkillName,
				Description: "Part of " + skillListing.DisplayName + " skill pack",
				Author:      skillListing.Author,
				Version:     skillListing.Version,
				Source:      "marketplace",
			}
			skills.WriteSkillMeta(ctx, agent.ID, "main", subSkillPath, meta)

			installedSkills = append(installedSkills, subSkillName)
		}

		// Write pack-level metadata
		packMeta := &skills.SkillMeta{
			Name:        skillListing.Name,
			Description: skillListing.Description,
			Author:      skillListing.Author,
			Version:     skillListing.Version,
			Source:      "marketplace",
		}
		skills.WriteSkillMeta(ctx, agent.ID, "main", skillListing.Path, packMeta)

		return util.Success(c, map[string]interface{}{
			"name":           skillListing.Path,
			"installed":      true,
			"skills":         installedSkills,
			"skillPack":      true,
		})
	}

	// Single skill installation
	content, err := defaultFetcher.FetchSkillContent(skillListing.Path)
	if err != nil {
		return util.InternalError(c, "failed to fetch skill content: "+err.Error())
	}

	// Fetch skill meta
	metaRaw, err := defaultFetcher.FetchSkillMeta(skillListing.Path)
	if err != nil {
		// Non-critical, we'll extract from content
		metaRaw = nil
	}

	// Write skill to pod
	if err := k8s.WriteSkill(ctx, agent.ID, "main", skillListing.Path, content); err != nil {
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

	if err := skills.WriteSkillMeta(ctx, agent.ID, "main", skillListing.Path, meta); err != nil {
		// Non-critical error
	}

	return util.Success(c, map[string]interface{}{
		"name":      skillListing.Path,
		"installed": true,
	})
}