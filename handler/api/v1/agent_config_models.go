package v1

import (
	"context"
	"fmt"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ProviderRequest represents a request to add/update a provider
type ProviderRequest struct {
	Name    string                      `json:"name"`
	BaseURL string                      `json:"baseUrl,omitempty"`
	APIKey  string                      `json:"apiKey,omitempty"`
	API     string                      `json:"api,omitempty"`
	Models  []model.ProviderModelConfig `json:"models,omitempty"`
}

// setDefaultModelIfNeeded sets the default model if none exists and the provider has models
// Also adds all provider models to agents.defaults.models
// Returns true if default model was set
func setDefaultModelIfNeeded(config *model.OpenClawConfig, providerName string, providerConfig *model.ProviderConfig) bool {
	// Check if provider has an API key (usable) and at least one model
	if providerConfig.APIKey == "" || len(providerConfig.Models) == 0 {
		return false
	}

	// Ensure agents section exists
	if config.Agents == nil {
		config.Agents = &model.AgentsConfig{}
	}
	if config.Agents.Defaults == nil {
		config.Agents.Defaults = &model.AgentDefaultsConfig{}
	}
	if config.Agents.Defaults.Model == nil {
		config.Agents.Defaults.Model = &model.AgentModelConfig{}
	}
	if config.Agents.Defaults.Models == nil {
		config.Agents.Defaults.Models = make(map[string]*model.AgentModelAlias)
	}

	// Add all provider models to agents.defaults.models
	for _, m := range providerConfig.Models {
		modelID := fmt.Sprintf("%s/%s", providerName, m.ID)
		if _, exists := config.Agents.Defaults.Models[modelID]; !exists {
			config.Agents.Defaults.Models[modelID] = &model.AgentModelAlias{}
		}
	}

	// Check if default model already exists
	if config.Agents.Defaults.Model.Primary != "" {
		return false
	}

	// Set default model to first model of the provider
	defaultModel := fmt.Sprintf("%s/%s", providerName, providerConfig.Models[0].ID)
	config.Agents.Defaults.Model.Primary = defaultModel
	return true
}

// ListBuiltInProviders returns all built-in provider metadata
// GET /providers
func ListBuiltInProviders(c echo.Context) error {
	providers := model.GetAllProviders()
	return util.Success(c, providers)
}

// GetBuiltInProvider returns a single built-in provider metadata
// GET /providers/:name
func GetBuiltInProvider(c echo.Context) error {
	providerName := c.Param("name")
	if providerName == "" {
		return util.BadRequest(c, "provider name is required")
	}

	meta := model.GetProviderMeta(providerName)
	if meta == nil {
		return util.NotFound(c, "provider not found")
	}

	return util.Success(c, meta)
}

// ListModelProviders returns all model providers for an agent
// GET /agents/:id/config/models
func ListModelProviders(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return util.InternalError(c, "failed to get agent config")
	}

	// Return providers map
	providers := make(map[string]*model.ProviderConfig)
	if config.Models != nil && config.Models.Providers != nil {
		providers = config.Models.Providers
	}

	return util.Success(c, providers)
}

// AddModelProvider adds a new model provider to the agent
// POST /agents/:id/config/models
func AddModelProvider(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	var req ProviderRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Name == "" {
		return util.BadRequest(c, "provider name is required")
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		config = &model.OpenClawConfig{}
	}

	// Ensure models section exists
	if config.Models == nil {
		config.Models = &model.ModelsConfig{
			Mode:      "merge",
			Providers: make(map[string]*model.ProviderConfig),
		}
	}
	if config.Models.Providers == nil {
		config.Models.Providers = make(map[string]*model.ProviderConfig)
	}

	// Check if provider already exists
	if _, exists := config.Models.Providers[req.Name]; exists {
		return util.BadRequest(c, "provider already exists")
	}

	// Build provider config, auto-filling from metadata if built-in provider
	providerConfig := &model.ProviderConfig{
		BaseURL: req.BaseURL,
		APIKey:  req.APIKey,
		API:     req.API,
		Models:  req.Models,
	}

	// Auto-fill from provider metadata if it's a built-in provider
	if meta := model.GetProviderMeta(req.Name); meta != nil {
		if providerConfig.BaseURL == "" {
			providerConfig.BaseURL = meta.BaseURL
		}
		if providerConfig.API == "" {
			providerConfig.API = meta.API
		}
		// Auto-fill models from metadata if not provided
		if len(providerConfig.Models) == 0 && len(meta.Models) > 0 {
			providerConfig.Models = make([]model.ProviderModelConfig, len(meta.Models))
			for i, m := range meta.Models {
				providerConfig.Models[i] = model.ProviderModelConfig{
					ID:            m.ID,
					Name:          m.Name,
					ContextWindow: m.ContextWindow,
					MaxTokens:     m.MaxTokens,
					Input:         m.Input,
				}
			}
		}
	}

	// Ensure Models is always an array (not nil) for OpenClaw validation
	if providerConfig.Models == nil {
		providerConfig.Models = []model.ProviderModelConfig{}
	}

	config.Models.Providers[req.Name] = providerConfig

	// Auto-set default model if this is the first usable provider
	defaultModelSet := setDefaultModelIfNeeded(config, req.Name, providerConfig)

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return util.InternalError(c, "failed to set config")
	}
	if err := model.UpdateAgent(agent); err != nil {
		return util.InternalError(c, "failed to update agent")
	}

	// Sync to pod if agent is running
	if agent.Status == model.AgentStatusRunning {
		go func() {
			ctx := context.Background()
			sections := []string{"models"}
			if defaultModelSet {
				sections = append(sections, "agents")
			}
			if err := k8s.SyncSectionsToPod(ctx, agent.ID, sections...); err != nil {
				c.Logger().Errorf("failed to sync config to pod: %v", err)
			}
		}()
	}

	return util.Success(c, config.Models.Providers[req.Name])
}

// GetModelProvider returns a single model provider by name
// GET /agents/:id/config/models/:provider
func GetModelProvider(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	providerName := c.Param("provider")
	if providerName == "" {
		return util.BadRequest(c, "provider name is required")
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return util.InternalError(c, "failed to get agent config")
	}

	if config.Models == nil || config.Models.Providers == nil {
		return util.NotFound(c, "provider not found")
	}

	provider, exists := config.Models.Providers[providerName]
	if !exists {
		return util.NotFound(c, "provider not found")
	}

	return util.Success(c, provider)
}

// UpdateModelProvider updates a model provider configuration
// PUT /agents/:id/config/models/:provider
func UpdateModelProvider(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	providerName := c.Param("provider")
	if providerName == "" {
		return util.BadRequest(c, "provider name is required")
	}

	var req ProviderRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		config = &model.OpenClawConfig{}
	}

	// Ensure models section exists
	if config.Models == nil {
		config.Models = &model.ModelsConfig{
			Mode:      "merge",
			Providers: make(map[string]*model.ProviderConfig),
		}
	}
	if config.Models.Providers == nil {
		config.Models.Providers = make(map[string]*model.ProviderConfig)
	}

	// Get existing config to preserve fields not provided
	existing := config.Models.Providers[providerName]

	// Build provider config, preserving existing values if not provided
	providerConfig := &model.ProviderConfig{
		BaseURL: req.BaseURL,
		APIKey:  req.APIKey,
		API:     req.API,
		Models:  req.Models,
	}

	// Preserve existing values if not provided in request
	if providerConfig.BaseURL == "" && existing != nil && existing.BaseURL != "" {
		providerConfig.BaseURL = existing.BaseURL
	}
	if providerConfig.APIKey == "" && existing != nil && existing.APIKey != "" {
		providerConfig.APIKey = existing.APIKey
	}
	if providerConfig.API == "" && existing != nil && existing.API != "" {
		providerConfig.API = existing.API
	}
	if len(providerConfig.Models) == 0 && existing != nil && len(existing.Models) > 0 {
		providerConfig.Models = existing.Models
	}

	// Auto-fill from provider metadata if it's a built-in provider
	if meta := model.GetProviderMeta(providerName); meta != nil {
		if providerConfig.BaseURL == "" {
			providerConfig.BaseURL = meta.BaseURL
		}
		if providerConfig.API == "" {
			providerConfig.API = meta.API
		}
		// Auto-fill models from metadata if not provided
		if len(providerConfig.Models) == 0 && len(meta.Models) > 0 {
			providerConfig.Models = make([]model.ProviderModelConfig, len(meta.Models))
			for i, m := range meta.Models {
				providerConfig.Models[i] = model.ProviderModelConfig{
					ID:            m.ID,
					Name:          m.Name,
					ContextWindow: m.ContextWindow,
					MaxTokens:     m.MaxTokens,
					Input:         m.Input,
				}
			}
		}
	}

	// Ensure Models is always an array (not nil) for OpenClaw validation
	if providerConfig.Models == nil {
		providerConfig.Models = []model.ProviderModelConfig{}
	}

	config.Models.Providers[providerName] = providerConfig

	// Auto-set default model if this provider now has an API key and no default exists
	defaultModelSet := setDefaultModelIfNeeded(config, providerName, providerConfig)

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return util.InternalError(c, "failed to set config")
	}
	if err := model.UpdateAgent(agent); err != nil {
		return util.InternalError(c, "failed to update agent")
	}

	// Sync to pod if agent is running
	if agent.Status == model.AgentStatusRunning {
		go func() {
			ctx := context.Background()
			sections := []string{"models"}
			if defaultModelSet {
				sections = append(sections, "agents")
			}
			if err := k8s.SyncSectionsToPod(ctx, agent.ID, sections...); err != nil {
				c.Logger().Errorf("failed to sync config to pod: %v", err)
			}
		}()
	}

	return util.Success(c, config.Models.Providers[providerName])
}

// DeleteModelProvider removes a model provider
// DELETE /agents/:id/config/models/:provider
func DeleteModelProvider(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	providerName := c.Param("provider")
	if providerName == "" {
		return util.BadRequest(c, "provider name is required")
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return util.InternalError(c, "failed to get agent config")
	}

	if config.Models == nil || config.Models.Providers == nil {
		return util.NotFound(c, "provider not found")
	}

	if _, exists := config.Models.Providers[providerName]; !exists {
		return util.NotFound(c, "provider not found")
	}

	// Delete provider
	delete(config.Models.Providers, providerName)

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return util.InternalError(c, "failed to set config")
	}
	if err := model.UpdateAgent(agent); err != nil {
		return util.InternalError(c, "failed to update agent")
	}

	// Sync only models section to pod if agent is running (don't touch gateway)
	if agent.Status == model.AgentStatusRunning {
		go func() {
			ctx := context.Background()
			if err := k8s.SyncSectionsToPod(ctx, agent.ID, "models"); err != nil {
				c.Logger().Errorf("failed to sync config to pod: %v", err)
			}
		}()
	}

	return util.Success(c, nil)
}
