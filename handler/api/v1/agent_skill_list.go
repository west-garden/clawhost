package v1

import (
	"context"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/skills"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type SkillInfo struct {
	Name        string `json:"name"`
	NameDisplay string `json:"name_display,omitempty"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
	InstalledAt int64  `json:"installedAt,omitempty"`
	Source      string `json:"source,omitempty"`
}

func ListSkills(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running, cannot list skills")
	}

	ctx := context.Background()

	// List skills with metadata
	skillList, err := skills.ListSkillsWithMeta(ctx, agent.ID, "main")
	if err != nil {
		return util.InternalError(c, "failed to list skills: "+err.Error())
	}

	// Convert to SkillInfo
	result := make([]SkillInfo, len(skillList))
	for i, s := range skillList {
		result[i] = SkillInfo{
			Name:        s.Name,
			NameDisplay: s.NameDisplay,
			Description: s.Description,
			Author:      s.Author,
			Version:     s.Version,
			InstalledAt: s.InstalledAt,
			Source:      s.Source,
		}
	}

	return util.Success(c, result)
}