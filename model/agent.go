package model

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/clawhost/clawhost/util"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AgentStatus string

const (
	AgentStatusCreated  AgentStatus = "created"
	AgentStatusStarting AgentStatus = "starting"
	AgentStatusRunning  AgentStatus = "running"
	AgentStatusStopped  AgentStatus = "stopped"
	AgentStatusError    AgentStatus = "error"
	AgentStatusDeleted  AgentStatus = "deleted"
)

type Agent struct {
	ID          string          `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID      string          `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Name        string          `json:"name" gorm:"type:varchar(255);not null"`
	Slug        string          `json:"slug" gorm:"type:varchar(100);uniqueIndex"`
	AccessToken string          `json:"access_token" gorm:"type:varchar(64)"` // Used for CLI commands and token auth
	AccessURL   string          `json:"access_url" gorm:"-"`                  // Computed field, not stored in DB
	Status      AgentStatus     `json:"status" gorm:"type:varchar(50);default:'created'"`
	Config      json.RawMessage `json:"config" gorm:"type:jsonb"` // OpenClaw config (gateway, models, agents, channels)
	Endpoint    string          `json:"endpoint" gorm:"type:varchar(255)"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty" gorm:"type:timestamp;index"` // nil means never expires
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// ModelProvider represents a model provider configuration
type ModelProvider struct {
	Name    string        `json:"name"` // Provider name (anthropic, openai, minimax)
	BaseURL string        `json:"base_url,omitempty"`
	APIKey  string        `json:"api_key,omitempty"`
	Auth    string        `json:"auth,omitempty"` // api-key, bearer
	API     string        `json:"api,omitempty"`  // anthropic-messages, openai-completions
	Models  []ModelConfig `json:"models,omitempty"`
}

// ModelConfig represents a single model configuration
type ModelConfig struct {
	ID            string   `json:"id"`
	Name          string   `json:"name,omitempty"`
	Reasoning     bool     `json:"reasoning,omitempty"`
	Input         []string `json:"input,omitempty"`
	ContextWindow int      `json:"context_window,omitempty"`
	MaxTokens     int      `json:"max_tokens,omitempty"`
}

// AgentDefaults represents agent default configuration
type AgentDefaults struct {
	PrimaryModel  string `json:"primary_model,omitempty"`  // e.g., "anthropic/claude-sonnet-4-20250514"
	FallbackModel string `json:"fallback_model,omitempty"` // e.g., "anthropic/claude-haiku-4-5-20251001"
}

type AgentConfig struct {
	// Legacy single provider fields (kept for backward compatibility)
	Provider string `json:"provider,omitempty"` // Provider key name in openclaw config (e.g., "anthropic", "minimax")
	Model    string `json:"model,omitempty"`
	APIKey   string `json:"api_key,omitempty"`
	BaseURL  string `json:"base_url,omitempty"` // For MiniMax or other Anthropic-compatible APIs
	Auth     string `json:"auth,omitempty"`     // Auth mode: "api-key" (default), "bearer", etc.
	API      string `json:"api,omitempty"`      // API format: "anthropic-messages" (default), "openai-completions", etc.

	// Multi-provider support
	Providers     []ModelProvider `json:"providers,omitempty"`
	AgentDefaults *AgentDefaults  `json:"agent_defaults,omitempty"`

	// Other fields
	AgentsMD   string      `json:"agents_md,omitempty"`
	SoulMD     string      `json:"soul_md,omitempty"`
	ToolsMD    string      `json:"tools_md,omitempty"`
	MCPServers []MCPServer `json:"mcp_servers,omitempty"`

	// Channels configuration (telegram, slack, discord, etc.)
	// Structure: {"telegram": {"accounts": {"default": {"botToken": "xxx", "dmPolicy": "open", ...}}}}
	Channels map[string]interface{} `json:"channels,omitempty"`
}

// GetProviders returns all providers, migrating legacy single provider if needed
func (c *AgentConfig) GetProviders() []ModelProvider {
	if len(c.Providers) > 0 {
		return c.Providers
	}
	// Migrate legacy single provider to providers list
	if c.Provider != "" || c.APIKey != "" {
		provider := ModelProvider{
			Name:    c.Provider,
			BaseURL: c.BaseURL,
			APIKey:  c.APIKey,
			Auth:    c.Auth,
			API:     c.API,
		}
		if provider.Name == "" {
			provider.Name = "anthropic"
		}
		// Add default model if Model is set
		if c.Model != "" {
			provider.Models = []ModelConfig{{
				ID:            c.Model,
				Name:          c.Model,
				Input:         []string{"text"},
				ContextWindow: 200000,
				MaxTokens:     8192,
			}}
		}
		return []ModelProvider{provider}
	}
	return nil
}

// GetProviderByName returns a provider by name
func (c *AgentConfig) GetProviderByName(name string) *ModelProvider {
	for i := range c.Providers {
		if c.Providers[i].Name == name {
			return &c.Providers[i]
		}
	}
	// Check legacy fields
	if (c.Provider == name || (c.Provider == "" && name == "anthropic")) && (c.APIKey != "" || c.BaseURL != "") {
		return &ModelProvider{
			Name:    name,
			BaseURL: c.BaseURL,
			APIKey:  c.APIKey,
			Auth:    c.Auth,
			API:     c.API,
		}
	}
	return nil
}

// AddOrUpdateProvider adds or updates a provider
func (c *AgentConfig) AddOrUpdateProvider(provider ModelProvider) {
	for i := range c.Providers {
		if c.Providers[i].Name == provider.Name {
			c.Providers[i] = provider
			return
		}
	}
	c.Providers = append(c.Providers, provider)
}

// DeleteProvider removes a provider by name
func (c *AgentConfig) DeleteProvider(name string) bool {
	for i := range c.Providers {
		if c.Providers[i].Name == name {
			c.Providers = append(c.Providers[:i], c.Providers[i+1:]...)
			return true
		}
	}
	return false
}

type MCPServer struct {
	Name         string            `json:"name"`
	Command      string            `json:"command"`
	Args         []string          `json:"args,omitempty"`
	Env          map[string]string `json:"env,omitempty"`
	ShareProcess bool              `json:"share_process,omitempty"`
}

func (Agent) TableName() string {
	return "agents"
}

func (a *Agent) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	// Generate slug if not provided (use first 8 chars of ID)
	if a.Slug == "" {
		a.Slug = strings.ReplaceAll(a.ID[:8], "-", "")
	}
	// Always generate a secure access token
	if a.AccessToken == "" {
		a.AccessToken = generateSecureToken(32)
	}
	return nil
}

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)[:length]
}

func (a *Agent) GetConfig() (*AgentConfig, error) {
	if a.Config == nil {
		return &AgentConfig{}, nil
	}
	var config AgentConfig
	if err := json.Unmarshal(a.Config, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func (a *Agent) SetConfig(config *AgentConfig) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	a.Config = data
	return nil
}

// SetConfigMap sets the agent config from a map (OpenClaw native format)
func (a *Agent) SetConfigMap(config map[string]interface{}) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	a.Config = data
	return nil
}

// GetConfigMap returns the agent config as a map
func (a *Agent) GetConfigMap() (map[string]interface{}, error) {
	if a.Config == nil {
		return make(map[string]interface{}), nil
	}
	var config map[string]interface{}
	if err := json.Unmarshal(a.Config, &config); err != nil {
		return nil, err
	}
	return config, nil
}

// Database operations

func CreateAgent(agent *Agent) error {
	return util.GetDB().Create(agent).Error
}

func GetAgentByID(id string) (*Agent, error) {
	var agent Agent
	if err := util.GetDB().Where("id = ?", id).First(&agent).Error; err != nil {
		return nil, err
	}
	return &agent, nil
}

func GetAgentByUserAndName(userID, name string) (*Agent, error) {
	var agent Agent
	if err := util.GetDB().Where("user_id = ? AND name = ?", userID, name).First(&agent).Error; err != nil {
		return nil, err
	}
	return &agent, nil
}

func GetAgentBySlug(slug string) (*Agent, error) {
	var agent Agent
	if err := util.GetDB().Where("slug = ?", slug).First(&agent).Error; err != nil {
		return nil, err
	}
	return &agent, nil
}

func ResetAgentAccessToken(id string) (string, error) {
	newToken := generateSecureToken(32)
	err := util.GetDB().Model(&Agent{}).Where("id = ?", id).Updates(map[string]interface{}{
		"access_token": newToken,
		"updated_at":   time.Now(),
	}).Error
	if err != nil {
		return "", err
	}
	return newToken, nil
}

func UpdateAgentSlug(id, slug string) error {
	return util.GetDB().Model(&Agent{}).Where("id = ?", id).Updates(map[string]interface{}{
		"slug":       slug,
		"updated_at": time.Now(),
	}).Error
}

func ListAgentsByUserID(userID string) ([]*Agent, error) {
	var agents []*Agent
	if err := util.GetDB().Where("user_id = ? AND status != ?", userID, AgentStatusDeleted).Order("created_at DESC").Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

func ListAgentsByStatus(status AgentStatus) ([]*Agent, error) {
	var agents []*Agent
	if err := util.GetDB().Where("status = ?", status).Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

func UpdateAgent(agent *Agent) error {
	return util.GetDB().Save(agent).Error
}

func DeleteAgent(id string) error {
	return util.GetDB().Where("id = ?", id).Delete(&Agent{}).Error
}

func ListAllAgents() ([]*Agent, error) {
	var agents []*Agent
	if err := util.GetDB().Where("status != ?", AgentStatusDeleted).Order("created_at DESC").Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

func CountAgents() (int64, error) {
	var count int64
	if err := util.GetDB().Model(&Agent{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func CountAgentsByStatus(status AgentStatus) (int64, error) {
	var count int64
	if err := util.GetDB().Model(&Agent{}).Where("status = ?", status).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func UpdateAgentStatus(id string, status AgentStatus, endpoint string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	if endpoint != "" {
		updates["endpoint"] = endpoint
	}
	return util.GetDB().Model(&Agent{}).Where("id = ?", id).Updates(updates).Error
}

// ListExpiredAgents returns agents that have expired beyond the grace period,
// ordered by expiration time (oldest first), limited to a batch size.
func ListExpiredAgents(grace time.Duration, limit int) ([]*Agent, error) {
	var agents []*Agent
	cutoff := time.Now().Add(-grace)
	if err := util.GetDB().
		Where("expires_at IS NOT NULL AND expires_at < ? AND status != ?", cutoff, AgentStatusDeleted).
		Order("expires_at ASC").
		Limit(limit).
		Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

// AutoMigrate creates the table if it doesn't exist
func AutoMigrate() error {
	// Migrate users table first
	if err := AutoMigrateUser(); err != nil {
		return err
	}
	if err := util.GetDB().AutoMigrate(&Agent{}); err != nil {
		return err
	}
	// Migrate existing agents without slug or access_token
	return migrateExistingAgents()
}

// migrateExistingAgents generates slug and access_token for existing agents
func migrateExistingAgents() error {
	var agents []Agent
	if err := util.GetDB().Where("slug = '' OR slug IS NULL OR access_token = '' OR access_token IS NULL").Find(&agents).Error; err != nil {
		return err
	}

	for _, agent := range agents {
		updates := map[string]interface{}{}
		if agent.Slug == "" {
			updates["slug"] = strings.ReplaceAll(agent.ID[:8], "-", "")
		}
		if agent.AccessToken == "" {
			updates["access_token"] = generateSecureToken(32)
		}
		if len(updates) > 0 {
			if err := util.GetDB().Model(&Agent{}).Where("id = ?", agent.ID).Updates(updates).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
