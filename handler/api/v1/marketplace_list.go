package v1

import (
	"github.com/clawhost/clawhost/service/marketplace"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

var defaultFetcher = marketplace.NewFetcher("", 0)

// ListMarketplaceSkills lists skills from the marketplace registry
func ListMarketplaceSkills(c echo.Context) error {
	category := c.QueryParam("category")
	search := c.QueryParam("search")

	index, err := defaultFetcher.FetchIndex()
	if err != nil {
		return util.InternalError(c, "failed to fetch marketplace: "+err.Error())
	}

	// Filter skills
	var skills []marketplace.SkillListing
	var categories []string
	categorySet := make(map[string]bool)

	for _, skill := range index.Skills {
		// Collect all categories
		if skill.Category != "" {
			categorySet[skill.Category] = true
		}

		// Filter by category
		if category != "" && skill.Category != category {
			continue
		}

		// Filter by search (matches name, display_name, description)
		if search != "" {
			searchLower := toLower(search)
			if !containsLower(skill.Name, searchLower) &&
				!containsLower(skill.DisplayName, searchLower) &&
				!containsLower(skill.Description, searchLower) {
				continue
			}
		}

		skills = append(skills, skill)
	}

	// Build category list
	for cat := range categorySet {
		categories = append(categories, cat)
	}

	return util.Success(c, map[string]interface{}{
		"skills":     skills,
		"categories": categories,
	})
}

// toLower converts string to lowercase (ASCII only for simplicity)
func toLower(s string) string {
	result := make([]byte, len(s))
	for i, c := range s {
		if c >= 'A' && c <= 'Z' {
			result[i] = byte(c - 'A' + 'a')
		} else {
			result[i] = byte(c)
		}
	}
	return string(result)
}

// containsLower checks if s contains substr (case-insensitive)
func containsLower(s, substr string) bool {
	sLower := toLower(s)
	for i := 0; i <= len(sLower)-len(substr); i++ {
		if sLower[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}