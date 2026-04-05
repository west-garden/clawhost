package v1

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ValidateProviderRequest represents a request to validate a provider's API key
type ValidateProviderRequest struct {
	APIKey          string `json:"apiKey"`
	BaseURL         string `json:"baseUrl,omitempty"`
	ValidationModel string `json:"validationModel,omitempty"` // 用户指定的验证模型
}

// ValidateCustomProviderRequest represents a request to validate a custom provider
type ValidateCustomProviderRequest struct {
	BaseURL         string `json:"baseUrl"`
	APIKey          string `json:"apiKey"`
	API             string `json:"api"` // anthropic-messages, openai-completions
	ValidationModel string `json:"validationModel,omitempty"`
}

// ValidateProviderResponse represents the validation result
type ValidateProviderResponse struct {
	Valid   bool   `json:"valid"`
	Error   string `json:"error,omitempty"`
	Models  []string `json:"models,omitempty"`  // Auto-discovered model IDs
}

// httpClient with 10 second timeout
var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// ValidateProviderApiKey validates a built-in provider's API key
// POST /api/v1/providers/:name/validate
func ValidateProviderApiKey(c echo.Context) error {
	providerName := c.Param("name")
	if providerName == "" {
		return util.BadRequest(c, "provider name is required")
	}

	// Get provider metadata
	meta := model.GetProviderMeta(providerName)
	if meta == nil {
		return util.NotFound(c, "provider not found")
	}

	var req ValidateProviderRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.APIKey == "" {
		return util.BadRequest(c, "apiKey is required")
	}

	// Determine base URL: user provided → provider default
	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = meta.BaseURL
	}

	// Determine validation model: user specified → first model in list → validationModel from meta
	validationModel := req.ValidationModel
	if validationModel == "" {
		if meta.ValidationModel != "" {
			validationModel = meta.ValidationModel
		} else if len(meta.Models) > 0 {
			validationModel = meta.Models[0].ID
		}
	}

	if validationModel == "" {
		return util.BadRequest(c, "no validation model available")
	}

	// Validate the API key
	valid, errMsg := validateApiKey(baseURL, req.APIKey, meta.API, validationModel)

	// Return provider's model list
	var modelIDs []string
	for _, m := range meta.Models {
		modelIDs = append(modelIDs, m.ID)
	}

	return util.Success(c, ValidateProviderResponse{
		Valid:  valid,
		Error:  errMsg,
		Models: modelIDs,
	})
}

// ValidateCustomProviderApiKey validates a custom provider's API key
// POST /api/v1/providers/validate-custom
func ValidateCustomProviderApiKey(c echo.Context) error {
	var req ValidateCustomProviderRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.BaseURL == "" {
		return util.BadRequest(c, "baseUrl is required")
	}

	if req.APIKey == "" {
		return util.BadRequest(c, "apiKey is required")
	}

	if req.API == "" {
		return util.BadRequest(c, "api type is required")
	}

	// Auto-fetch models from provider if no validation model specified
	validationModel := req.ValidationModel
	var discoveredModels []string
	if validationModel == "" {
		models, err := fetchProviderModels(req.BaseURL, req.APIKey, req.API)
		if err == nil && len(models) > 0 {
			discoveredModels = models
			validationModel = models[0]
		}
	}

	if validationModel == "" {
		return util.BadRequest(c, "could not discover models from provider — please specify a validation model in the request, or ensure your provider supports the /v1/models endpoint")
	}

	// Validate the API key
	valid, errMsg := validateApiKey(req.BaseURL, req.APIKey, req.API, validationModel)

	resp := ValidateProviderResponse{
		Valid:  valid,
		Error:  errMsg,
		Models: discoveredModels,
	}

	return util.Success(c, resp)
}

// FetchCustomProviderModels fetches available models from a custom provider
// POST /api/v1/providers/fetch-models
func FetchCustomProviderModels(c echo.Context) error {
	var req struct {
		BaseURL string `json:"baseUrl"`
		APIKey  string `json:"apiKey"`
		API     string `json:"api"`
	}
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.BaseURL == "" {
		return util.BadRequest(c, "baseUrl is required")
	}
	if req.APIKey == "" {
		return util.BadRequest(c, "apiKey is required")
	}
	if req.API == "" {
		return util.BadRequest(c, "api type is required")
	}

	models, err := fetchProviderModels(req.BaseURL, req.APIKey, req.API)
	if err != nil {
		return util.BadRequest(c, err.Error())
	}

	return util.Success(c, map[string]interface{}{
		"models": models,
	})
}

// validateApiKey performs the actual API key validation
func validateApiKey(baseURL, apiKey, apiType, model string) (bool, string) {
	switch apiType {
	case "anthropic-messages":
		return validateAnthropicApiKey(baseURL, apiKey, model)
	case "openai-completions":
		return validateOpenAiCompatibleApiKey(baseURL, apiKey, model)
	default:
		return false, fmt.Sprintf("unsupported API type: %s", apiType)
	}
}

// validateAnthropicApiKey validates an Anthropic API key
func validateAnthropicApiKey(baseURL, apiKey, model string) (bool, string) {
	// Anthropic API endpoint: {baseUrl}/v1/messages
	url := baseURL + "/v1/messages"

	// Build request body
	body := map[string]interface{}{
		"model":      model,
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return false, "failed to build request body"
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return false, "failed to create request"
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	// Send request
	resp, err := httpClient.Do(req)
	if err != nil {
		return false, fmt.Sprintf("network error: %v", err)
	}
	defer resp.Body.Close()

	// Read response body for error details
	respBody, _ := io.ReadAll(resp.Body)

	// Check response status
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return true, ""
	}

	// Check for authentication errors
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		// Parse error response to check for specific error types
		var errResp map[string]interface{}
		if json.Unmarshal(respBody, &errResp) == nil {
			if errType, ok := errResp["type"].(string); ok {
				if strings.Contains(errType, "invalid_api_key") ||
					strings.Contains(errType, "authentication_error") {
					return false, "invalid API key"
				}
			}
			if errType, ok := errResp["error"].(map[string]interface{}); ok {
				if typeStr, ok := errType["type"].(string); ok {
					if strings.Contains(typeStr, "invalid_api_key") ||
						strings.Contains(typeStr, "authentication_error") {
						return false, "invalid API key"
					}
				}
			}
		}
		return false, "authentication failed"
	}

	// Other errors (rate limit, model not found, etc.) - key might still be valid
	return false, fmt.Sprintf("request failed with status %d: %s", resp.StatusCode, string(respBody))
}

// validateOpenAiCompatibleApiKey validates an OpenAI-compatible API key
func validateOpenAiCompatibleApiKey(baseURL, apiKey, model string) (bool, string) {
	// OpenAI-compatible endpoint: {baseUrl}/chat/completions
	// Handle URLs that already have /v1 suffix
	url := baseURL
	if !strings.HasSuffix(url, "/v1") && !strings.HasSuffix(url, "/v1/") {
		url = url + "/v1"
	}
	url = strings.TrimSuffix(url, "/") + "/chat/completions"

	// Build request body
	body := map[string]interface{}{
		"model":      model,
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return false, "failed to build request body"
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return false, "failed to create request"
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// Send request
	resp, err := httpClient.Do(req)
	if err != nil {
		return false, fmt.Sprintf("network error: %v", err)
	}
	defer resp.Body.Close()

	// Read response body for error details
	respBody, _ := io.ReadAll(resp.Body)

	// Check response status
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return true, ""
	}

	// Check for authentication errors
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		// Parse error response to check for specific error types
		var errResp map[string]interface{}
		if json.Unmarshal(respBody, &errResp) == nil {
			if errObj, ok := errResp["error"].(map[string]interface{}); ok {
				if msg, ok := errObj["message"].(string); ok {
					if strings.Contains(strings.ToLower(msg), "invalid api key") ||
						strings.Contains(strings.ToLower(msg), "invalid_api_key") ||
						strings.Contains(strings.ToLower(msg), "authentication") ||
						strings.Contains(strings.ToLower(msg), "unauthorized") {
						return false, "invalid API key"
					}
				}
				if errType, ok := errObj["type"].(string); ok {
					if strings.Contains(errType, "invalid_api_key") {
						return false, "invalid API key"
					}
				}
			}
		}
		return false, "authentication failed"
	}

	// Other errors (rate limit, model not found, insufficient quota, etc.)
	// The key is likely valid but there may be other issues
	return false, fmt.Sprintf("request failed with status %d: %s", resp.StatusCode, string(respBody))
}

// fetchProviderModels queries the provider's models listing endpoint.
// For OpenAI-compatible APIs: GET {baseUrl}/v1/models
// For Anthropic: no standard models endpoint, returns empty list
func fetchProviderModels(baseURL, apiKey, apiType string) ([]string, error) {
	if apiType != "openai-completions" {
		// Anthropic doesn't have a models listing endpoint
		return nil, nil
	}

	// Build models URL
	modelsURL := strings.TrimSuffix(baseURL, "/") + "/models"
	if !strings.HasSuffix(baseURL, "/v1") && !strings.HasSuffix(baseURL, "/v1/") {
		modelsURL = strings.TrimSuffix(baseURL, "/") + "/v1/models"
	}

	parsed, err := url.Parse(modelsURL)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("models endpoint returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	var models []string
	seen := make(map[string]bool)
	for _, m := range data.Data {
		if m.ID != "" && !seen[m.ID] {
			seen[m.ID] = true
			models = append(models, m.ID)
		}
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("no models found")
	}

	sort.Strings(models)
	return models, nil
}