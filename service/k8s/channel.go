package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/clawhost/clawhost/model"
)

// ChannelConfig represents a channel configuration
type ChannelConfig struct {
	Token         string                 `json:"token,omitempty"`
	BotToken      string                 `json:"botToken,omitempty"`      // Slack
	AppToken      string                 `json:"appToken,omitempty"`      // Slack
	AppID         string                 `json:"appId,omitempty"`         // Feishu, Teams
	AppSecret     string                 `json:"appSecret,omitempty"`     // Feishu
	AppPassword   string                 `json:"appPassword,omitempty"`   // Teams
	ChannelSecret string                 `json:"channelSecret,omitempty"` // LINE
	Extra         map[string]interface{} `json:"extra,omitempty"`         // Additional config
}

// --- Pairing file structures (matches WestClaw/apps/desktop/src/api-routes/channel-routes.ts) ---

type pairingStore struct {
	Version  int                      `json:"version"`
	Requests []ChannelPairingListItem `json:"requests"`
}

type allowFromStore struct {
	Version   int      `json:"version"`
	AllowFrom []string `json:"allowFrom"`
}

// credentialsPath returns the credentials directory path inside the pod
func credentialsPath() string {
	return "/home/node/.openclaw/credentials"
}

// pairingFilePath returns the pairing requests file for a channel
func pairingFilePath(channel string) string {
	return fmt.Sprintf("%s/%s-pairing.json", credentialsPath(), channel)
}

// allowFromFilePath returns the allowFrom list file for a channel
func allowFromFilePath(channel string) string {
	return fmt.Sprintf("%s/%s-allowFrom.json", credentialsPath(), channel)
}

// readPairingFile reads the pairing requests file directly (fast — no Node.js spawn)
func readPairingFile(ctx context.Context, namespace, podName, channel string) ([]ChannelPairingListItem, error) {
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", pairingFilePath(channel)})
	if err != nil {
		// File doesn't exist = no pending requests
		if strings.Contains(err.Error(), "No such file") {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read pairing file: %w", err)
	}

	var store pairingStore
	if err := json.Unmarshal([]byte(output), &store); err != nil {
		return nil, fmt.Errorf("failed to parse pairing file: %w", err)
	}

	return store.Requests, nil
}

// writePairingFile writes the pairing requests file
func writePairingFile(ctx context.Context, namespace, podName, channel string, requests []ChannelPairingListItem) error {
	store := pairingStore{Version: 1, Requests: requests}
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal pairing data: %w", err)
	}

	script := fmt.Sprintf(`cat > %s << 'EOF'\n%s\nEOF`, pairingFilePath(channel), string(data))
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", script})
	return err
}

// readAllowFromFile reads the allowFrom list file directly
func readAllowFromFile(ctx context.Context, namespace, podName, channel string) ([]string, error) {
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", allowFromFilePath(channel)})
	if err != nil {
		if strings.Contains(err.Error(), "No such file") {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read allowFrom file: %w", err)
	}

	var store allowFromStore
	if err := json.Unmarshal([]byte(output), &store); err != nil {
		return nil, fmt.Errorf("failed to parse allowFrom file: %w", err)
	}

	return store.AllowFrom, nil
}

// writeAllowFromFile writes the allowFrom list file
func writeAllowFromFile(ctx context.Context, namespace, podName, channel string, allowFrom []string) error {
	store := allowFromStore{Version: 1, AllowFrom: allowFrom}
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal allowFrom data: %w", err)
	}

	script := fmt.Sprintf(`cat > %s << 'EOF'\n%s\nEOF`, allowFromFilePath(channel), string(data))
	_, err = ExecInPod(ctx, namespace, podName, "openclaw", []string{"sh", "-c", script})
	return err
}

// AddChannelToAgent adds an IM channel account to an agent's OpenClaw instance
// This uses the database as the source of truth and syncs the channels section to the pod
// Supports multi-account: channels.telegram.accounts.{accountName}
func AddChannelToAgent(ctx context.Context, botID, accessToken, channel, account string, channelConfig map[string]interface{}) error {
	// Get agent from database
	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return fmt.Errorf("failed to get agent: %w", err)
	}

	// Get existing config from database
	config, err := agent.GetOpenClawConfig()
	if err != nil {
		config = &model.OpenClawConfig{}
	}

	// Ensure channels map exists
	if config.Channels == nil {
		config.Channels = make(model.ChannelsConfig)
	}

	// Separate channel-level fields from account-level fields
	// Channel-level: dmPolicy, groupPolicy, enabled, allowFrom (same level as "accounts")
	// Account-level: botToken, appId, appSecret, etc. (inside accounts.{name})
	channelLevelKeys := map[string]bool{
		"dmPolicy": true, "groupPolicy": true,
		"enabled": true, "allowFrom": true,
	}
	channelLevelConfig := make(map[string]interface{})
	accountConfig := make(map[string]interface{})
	for k, v := range channelConfig {
		if channelLevelKeys[k] {
			channelLevelConfig[k] = v
		} else {
			accountConfig[k] = v
		}
	}

	// Set channel-level defaults if not provided
	if _, ok := channelLevelConfig["dmPolicy"]; !ok {
		channelLevelConfig["dmPolicy"] = "pairing"
	}
	if _, ok := channelLevelConfig["enabled"]; !ok {
		channelLevelConfig["enabled"] = true
	}

	// Validate dmPolicy="open" requires allowFrom to include "*"
	if dmPolicy, ok := channelLevelConfig["dmPolicy"].(string); ok && dmPolicy == "open" {
		allowFrom, _ := channelLevelConfig["allowFrom"].([]interface{})
		hasWildcard := false
		for _, v := range allowFrom {
			if s, ok := v.(string); ok && s == "*" {
				hasWildcard = true
				break
			}
		}
		if !hasWildcard {
			allowFrom = append(allowFrom, "*")
			channelLevelConfig["allowFrom"] = allowFrom
		}
	}

	// Build or merge channel config
	// If channel already exists in DB config, merge into it (preserve existing accounts)
	existingChannel, exists := config.Channels[channel]
	if !exists {
		existingChannel = make(map[string]interface{})
		config.Channels[channel] = existingChannel
	}
	chCfg, ok := existingChannel.(map[string]interface{})
	if !ok {
		chCfg = make(map[string]interface{})
		config.Channels[channel] = chCfg
	}

	// Apply channel-level config
	for k, v := range channelLevelConfig {
		chCfg[k] = v
	}

	// Get or create accounts map
	if chCfg["accounts"] == nil {
		chCfg["accounts"] = make(map[string]interface{})
	}
	accounts, ok := chCfg["accounts"].(map[string]interface{})
	if !ok {
		accounts = make(map[string]interface{})
		chCfg["accounts"] = accounts
	}

	// Add/update the account
	accounts[account] = accountConfig

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	if err := model.UpdateAgent(agent); err != nil {
		return fmt.Errorf("failed to update agent: %w", err)
	}

	// Sync channels section to pod and restart to ensure OpenClaw picks up the change
	if agent.Status == model.AgentStatusRunning {
		if err := SyncSectionsToPod(ctx, botID, "channels"); err != nil {
			fmt.Printf("Warning: failed to sync channels to pod: %v\n", err)
		}
		if err := RestartDeployment(ctx, botID); err != nil {
			fmt.Printf("Warning: failed to restart deployment: %v\n", err)
		}
	}

	return nil
}

// ChannelAccountInfo represents a channel account in the list
type ChannelAccountInfo struct {
	Channel  string                 `json:"channel"`
	Account  string                 `json:"account"`
	Name     string                 `json:"name,omitempty"`
	Status   string                 `json:"status"`
	Config   map[string]interface{} `json:"config,omitempty"`
}

// ListAgentChannels lists all configured channel accounts for an agent
// Returns a map of channel -> account info for frontend compatibility
func ListAgentChannels(ctx context.Context, botID, accessToken string) (map[string]interface{}, error) {
	namespace := GetNamespace()

	podName, err := WaitForPodReady(ctx, botID, 30)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %w", err)
	}

	// Read config file
	config, err := readOpenClawConfig(ctx, namespace, podName)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	// Extract channels and build result map
	result := make(map[string]interface{})
	if channels, ok := config["channels"].(map[string]interface{}); ok {
		for channelName, channelData := range channels {
			channelConfig, ok := channelData.(map[string]interface{})
			if !ok {
				continue
			}

			// Create channel entry with basic info
			channelInfo := map[string]interface{}{
				"enabled": true,
			}

			// Copy enabled status if present
			if enabled, ok := channelConfig["enabled"]; ok {
				channelInfo["enabled"] = enabled
			}

			// Extract accounts from config
			if accounts, ok := channelConfig["accounts"].(map[string]interface{}); ok {
				accountNames := make([]string, 0, len(accounts))
				for accountName := range accounts {
					accountNames = append(accountNames, accountName)
				}
				channelInfo["accounts"] = accountNames
			}

			result[channelName] = channelInfo
		}
	}

	// For openclaw-weixin, also check the accounts.json file (authoritative source)
	// This handles the case where accounts are stored in files but not in openclaw.json
	if _, exists := result["openclaw-weixin"]; exists || true {
		accountsJSON, err := ExecInPod(ctx, namespace, podName, "openclaw",
			[]string{"cat", "/home/node/.openclaw/openclaw-weixin/accounts.json"})
		if err == nil && accountsJSON != "" {
			var accountIDs []string
			if json.Unmarshal([]byte(accountsJSON), &accountIDs) == nil && len(accountIDs) > 0 {
				// Use accounts.json as the authoritative source
				channelInfo := map[string]interface{}{
					"enabled":  true,
					"accounts": accountIDs,
				}
				result["openclaw-weixin"] = channelInfo
			}
		}
	}

	return result, nil
}

// enrichWeixinAccountNames reads name from WeChat credential files and sets the Name field
func enrichWeixinAccountNames(ctx context.Context, namespace, podName string, accounts []ChannelAccountInfo) {
	for i := range accounts {
		if accounts[i].Channel != "openclaw-weixin" {
			continue
		}
		// Read credential file for this account
		credPath := fmt.Sprintf("/home/node/.openclaw/openclaw-weixin/accounts/%s.json", accounts[i].Account)
		output, err := ExecInPod(ctx, namespace, podName, "openclaw",
			[]string{"cat", credPath})
		if err != nil {
			accounts[i].Name = accounts[i].Account
			continue
		}
		var cred struct {
			Name string `json:"name"`
		}
		if json.Unmarshal([]byte(output), &cred) == nil && cred.Name != "" {
			accounts[i].Name = cred.Name
		} else {
			accounts[i].Name = accounts[i].Account
		}
	}
}

// RemoveChannelFromAgent removes an IM channel account from an agent
// If account is empty, removes the entire channel; otherwise removes specific account
func RemoveChannelFromAgent(ctx context.Context, botID, accessToken, channel, account string) error {
	// Get agent from database
	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return fmt.Errorf("failed to get agent: %w", err)
	}

	// Get existing config from database
	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	// Remove channel or account from config
	channels := config.Channels
	if channels == nil {
		return fmt.Errorf("no channels configured")
	}

	if account == "" {
		// Remove entire channel
		delete(channels, channel)
	} else {
		// Remove specific account
		if channelConfig, ok := channels[channel].(map[string]interface{}); ok {
			if accounts, ok := channelConfig["accounts"].(map[string]interface{}); ok {
				delete(accounts, account)
				// If no accounts left, remove the channel
				if len(accounts) == 0 {
					delete(channels, channel)
				}
			}
		}
	}

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	if err := model.UpdateAgent(agent); err != nil {
		return fmt.Errorf("failed to update agent: %w", err)
	}

	// Sync channels section to pod and restart
	if agent.Status == model.AgentStatusRunning {
		if err := SyncSectionsToPod(ctx, botID, "channels"); err != nil {
			fmt.Printf("Warning: failed to sync channels to pod: %v\n", err)
		}
		if err := RestartDeployment(ctx, botID); err != nil {
			fmt.Printf("Warning: failed to restart deployment: %v\n", err)
		}
	}

	return nil
}

// buildChannelConfig builds channel-specific configuration
func buildChannelConfig(channel, botToken, appToken string) map[string]interface{} {
	config := make(map[string]interface{})

	// Set botToken if provided (used by telegram, discord, slack, etc.)
	if botToken != "" {
		config["botToken"] = botToken
	}

	// Set appToken if provided (used by slack)
	if appToken != "" {
		config["appToken"] = appToken
	}

	return config
}

// readOpenClawConfig reads the openclaw.json config file from the pod
func readOpenClawConfig(ctx context.Context, namespace, podName string) (map[string]interface{}, error) {
	output, err := ExecInPod(ctx, namespace, podName, "openclaw",
		[]string{"cat", "/home/node/.openclaw/openclaw.json"})
	if err != nil {
		// If file doesn't exist, return empty config
		if strings.Contains(err.Error(), "No such file") {
			return make(map[string]interface{}), nil
		}
		return nil, err
	}

	var config map[string]interface{}
	if err := json.Unmarshal([]byte(output), &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return config, nil
}

// FixAgentConfigDMPolicies reads the agent config from database and fixes any dmPolicy="open" channels missing allowFrom=["*"]
// This is used to fix existing configs that were created before the validation was added
func FixAgentConfigDMPolicies(ctx context.Context, botID string) error {
	// Get agent from database
	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return fmt.Errorf("failed to get agent: %w", err)
	}

	// Get config from database
	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	// Convert to generic map for fixChannelDMPolicies
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	var configMap map[string]interface{}
	if err := json.Unmarshal(configJSON, &configMap); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Fix dmPolicy="open" channels
	fixed := fixChannelDMPolicies(configMap)
	if !fixed {
		return nil // No fixes needed
	}

	// Convert fixed configMap back to OpenClawConfig struct
	fixedJSON, err := json.Marshal(configMap)
	if err != nil {
		return fmt.Errorf("failed to marshal fixed config: %w", err)
	}
	if err := json.Unmarshal(fixedJSON, config); err != nil {
		return fmt.Errorf("failed to unmarshal fixed config: %w", err)
	}

	// Save to database
	if err := agent.SetOpenClawConfig(config); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	if err := model.UpdateAgent(agent); err != nil {
		return fmt.Errorf("failed to update agent: %w", err)
	}

	// Sync channels section to pod
	if agent.Status == model.AgentStatusRunning {
		return SyncSectionsToPod(ctx, botID, "channels")
	}

	return nil
}

// fixChannelDMPolicies validates and fixes all channels with dmPolicy="open"
// Returns true if any fixes were made
func fixChannelDMPolicies(config map[string]interface{}) bool {
	channels, ok := config["channels"].(map[string]interface{})
	if !ok {
		return false
	}

	fixed := false
	for _, channelData := range channels {
		channelConfig, ok := channelData.(map[string]interface{})
		if !ok {
			continue
		}

		// Check if dmPolicy="open"
		dmPolicy, ok := channelConfig["dmPolicy"].(string)
		if !ok || dmPolicy != "open" {
			continue
		}

		// Check if allowFrom already contains "*"
		allowFrom, _ := channelConfig["allowFrom"].([]interface{})
		hasWildcard := false
		for _, v := range allowFrom {
			if s, ok := v.(string); ok && s == "*" {
				hasWildcard = true
				break
			}
		}

		// Auto-add "*" to allowFrom when dmPolicy="open"
		if !hasWildcard {
			allowFrom = append(allowFrom, "*")
			channelConfig["allowFrom"] = allowFrom
			fixed = true
		}
	}

	return fixed
}

// ApproveChannelPairing approves a channel pairing request using the pairing code
// Example: openclaw pairing approve telegram JDB55KTQ
// ApproveChannelPairingResult holds the result of approving a pairing request
type ApproveChannelPairingResult struct {
	Output string
	UserID string
}

// ApproveChannelPairing approves a pending channel pairing request
// Reads pairing file directly (fast cat, no Node.js CLI spawn).
func ApproveChannelPairing(ctx context.Context, botID, channel, code string) (*ApproveChannelPairingResult, error) {
	namespace := GetNamespace()

	podName, err := WaitForPodReady(ctx, botID, 30)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %w", err)
	}

	// Read pairing file directly (fast — just cat a JSON file)
	requests, err := readPairingFile(ctx, namespace, podName, channel)
	if err != nil {
		return nil, fmt.Errorf("failed to read pairing requests: %w", err)
	}

	// Find the request by code
	codeUpper := strings.ToUpper(strings.TrimSpace(code))
	var targetUserID string
	var foundIdx int = -1
	for i, req := range requests {
		if strings.ToUpper(strings.TrimSpace(req.Code)) == codeUpper {
			targetUserID = req.ID
			foundIdx = i
			break
		}
	}

	if foundIdx < 0 {
		return nil, fmt.Errorf("pairing code %s not found", code)
	}

	// Remove the approved request from the list
	requests = append(requests[:foundIdx], requests[foundIdx+1:]...)
	if err := writePairingFile(ctx, namespace, podName, channel, requests); err != nil {
		fmt.Printf("[ApprovePairing] Warning: failed to write pairing file: %v\n", err)
	}

	// Add user to allowFrom file
	allowFrom, _ := readAllowFromFile(ctx, namespace, podName, channel)
	found := false
	for _, id := range allowFrom {
		if id == targetUserID {
			found = true
			break
		}
	}
	if !found && targetUserID != "" {
		allowFrom = append(allowFrom, targetUserID)
		if err := writeAllowFromFile(ctx, namespace, podName, channel, allowFrom); err != nil {
			fmt.Printf("[ApprovePairing] Warning: failed to write allowFrom file: %v\n", err)
		}
	}

	// Also persist to DB so it survives pod restarts
	if targetUserID != "" {
		if err := addUserToAllowFromDB(botID, channel, targetUserID); err != nil {
			fmt.Printf("[ApprovePairing] DB sync warning for agent %s: %v\n", botID, err)
		}
	}

	fmt.Printf("[ApprovePairing] Approved channel=%s code=%s user=%s (direct file write)\n", channel, code, targetUserID)

	return &ApproveChannelPairingResult{
		Output: "pairing approved successfully",
		UserID: targetUserID,
	}, nil
}

// addUserToAllowFromDB adds a user to the allowFrom list in the database config
func addUserToAllowFromDB(botID, channel, userID string) error {
	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return fmt.Errorf("failed to get agent: %w", err)
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	if config.Channels == nil {
		config.Channels = make(map[string]interface{})
	}

	channelConfig, ok := config.Channels[channel].(map[string]interface{})
	if !ok {
		return fmt.Errorf("channel %s not configured", channel)
	}

	allowFrom, _ := channelConfig["allowFrom"].([]interface{})
	for _, v := range allowFrom {
		if s, ok := v.(string); ok && s == userID {
			return nil // already in list
		}
	}
	allowFrom = append(allowFrom, userID)
	channelConfig["allowFrom"] = allowFrom

	if err := agent.SetOpenClawConfig(config); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	return model.UpdateAgent(agent)
}

// ChannelPairingResponse represents the response from openclaw pairing list
type ChannelPairingResponse struct {
	Channel  string                   `json:"channel"`
	Requests []ChannelPairingListItem `json:"requests"`
}

// ChannelPairingListItem represents a single pairing request
type ChannelPairingListItem struct {
	ID         string                 `json:"id"`
	Code       string                 `json:"code"`
	CreatedAt  string                 `json:"createdAt"`
	LastSeenAt string                 `json:"lastSeenAt"`
	Meta       map[string]interface{} `json:"meta"`
}

// ChannelPairedUser represents a paired user
type ChannelPairedUser struct {
	ID       string                 `json:"id"`
	Username string                 `json:"username,omitempty"`
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

// ListChannelPairingRequests lists pending pairing requests for a channel
// Reads pairing file directly (fast cat, no Node.js CLI spawn).
func ListChannelPairingRequests(ctx context.Context, botID, channel string) (*ChannelPairingResponse, error) {
	namespace := GetNamespace()

	podName, err := WaitForPodReady(ctx, botID, 30)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %w", err)
	}

	// Read pairing file directly (fast — just cat a JSON file)
	requests, err := readPairingFile(ctx, namespace, podName, channel)
	if err != nil {
		return nil, fmt.Errorf("failed to read pairing requests: %w", err)
	}

	return &ChannelPairingResponse{
		Channel:  channel,
		Requests: requests,
	}, nil
}

// RevokeChannelPairing revokes a channel pairing for a user
// This removes the user from the allowFrom list
func RevokeChannelPairing(ctx context.Context, botID, channel, userID string) (string, error) {
	namespace := GetNamespace()

	podName, err := WaitForPodReady(ctx, botID, 30)
	if err != nil {
		return "", fmt.Errorf("failed to get pod: %w", err)
	}

	// Remove from allowFrom file
	allowFrom, _ := readAllowFromFile(ctx, namespace, podName, channel)
	var newAllowFrom []string
	for _, id := range allowFrom {
		if id != userID {
			newAllowFrom = append(newAllowFrom, id)
		}
	}

	if len(newAllowFrom) != len(allowFrom) {
		if err := writeAllowFromFile(ctx, namespace, podName, channel, newAllowFrom); err != nil {
			fmt.Printf("[RevokePairing] Warning: failed to write allowFrom file: %v\n", err)
		}
	}

	// Also remove from DB config
	if err := removeUserFromAllowFromDB(botID, channel, userID); err != nil {
		fmt.Printf("[RevokePairing] DB sync warning for agent %s: %v\n", botID, err)
	}

	fmt.Printf("[RevokePairing] Revoked channel=%s user=%s\n", channel, userID)
	return "user removed from allowFrom list", nil
}

func removeUserFromAllowFromDB(botID, channel, userID string) error {
	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return fmt.Errorf("failed to get agent: %w", err)
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	if config.Channels == nil {
		return nil
	}

	channelConfig, ok := config.Channels[channel].(map[string]interface{})
	if !ok {
		return nil
	}

	if allowFrom, ok := channelConfig["allowFrom"].([]interface{}); ok {
		var newAllowFrom []interface{}
		for _, v := range allowFrom {
			if str, ok := v.(string); ok && str != userID {
				newAllowFrom = append(newAllowFrom, v)
			} else if num, ok := v.(float64); ok && fmt.Sprintf("%.0f", num) != userID {
				newAllowFrom = append(newAllowFrom, v)
			}
		}
		channelConfig["allowFrom"] = newAllowFrom
	}

	if err := agent.SetOpenClawConfig(config); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	return model.UpdateAgent(agent)
}

// GetChannelPairedUsers gets the list of paired users for a channel
// Reads allowFrom file directly (fast cat), falls back to DB config.
func GetChannelPairedUsers(ctx context.Context, botID, channel string) ([]ChannelPairedUser, error) {
	namespace := GetNamespace()

	podName, err := WaitForPodReady(ctx, botID, 30)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %w", err)
	}

	// Read allowFrom file directly (fast)
	allowFrom, err := readAllowFromFile(ctx, namespace, podName, channel)
	if err != nil {
		fmt.Printf("[GetPairedUsers] Warning: failed to read allowFrom file, falling back to DB: %v\n", err)
		return getPairedUsersFromDB(botID, channel)
	}

	users := make([]ChannelPairedUser, 0, len(allowFrom))
	for _, id := range allowFrom {
		user := ChannelPairedUser{ID: id}
		if strings.HasPrefix(id, "@") {
			user.Username = id[1:]
		}
		user.Meta = map[string]interface{}{"source": "allowFrom"}
		users = append(users, user)
	}

	return users, nil
}

func getPairedUsersFromDB(botID, channel string) ([]ChannelPairedUser, error) {
	var users []ChannelPairedUser

	agent, err := model.GetAgentByID(botID)
	if err != nil {
		return users, nil
	}

	config, err := agent.GetOpenClawConfig()
	if err != nil {
		return users, nil
	}

	channels := config.Channels
	if channels == nil {
		return users, nil
	}

	channelConfig, ok := channels[channel].(map[string]interface{})
	if !ok {
		return users, nil
	}

	if allowFrom, ok := channelConfig["allowFrom"].([]interface{}); ok {
		for _, v := range allowFrom {
			var user ChannelPairedUser
			switch val := v.(type) {
			case string:
				if strings.HasPrefix(val, "@") {
					user.Username = val[1:]
				} else {
					user.ID = val
				}
			case float64:
				user.ID = fmt.Sprintf("%.0f", val)
			}
			if user.ID != "" || user.Username != "" {
				user.Meta = map[string]interface{}{"source": "allowFrom"}
				users = append(users, user)
			}
		}
	}

	return users, nil
}
