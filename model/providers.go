package model
// ProviderMeta represents provider metadata including available models
type ProviderMeta struct {
	ID              string      `json:"id"`
	Label           string      `json:"label"`
	BaseURL         string      `json:"baseUrl"`
	API             string      `json:"api"` // anthropic-messages, openai-completions
	Models          []ModelInfo `json:"models"`
	APIKeyURL       string      `json:"apiKeyUrl,omitempty"`
	EnvVar          string      `json:"envVar,omitempty"`
	URL             string      `json:"url,omitempty"`
	ValidationModel string      `json:"validationModel,omitempty"` // 用于验证 API key 的轻量模型
}
// ModelInfo represents a model in provider metadata
type ModelInfo struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	ContextWindow int      `json:"contextWindow,omitempty"`
	MaxTokens     int      `json:"maxTokens,omitempty"`
	Input         []string `json:"input,omitempty"` // ["text"] or ["text", "image"]
}
// Built-in providers with their models (synced with WestClaw)
var builtinProviders = map[string]ProviderMeta{
	"anthropic": {
		ID:              "anthropic",
		Label:           "Anthropic",
		BaseURL:         "https://api.anthropic.com",
		API:             "anthropic-messages",
		ValidationModel: "claude-3-5-haiku-20241022",
		Models: []ModelInfo{
			{ID: "claude-sonnet-4-20250514", Name: "Claude Sonnet 4", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "claude-3-5-sonnet-20241022", Name: "Claude 3.5 Sonnet", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "claude-3-5-haiku-20241022", Name: "Claude 3.5 Haiku", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "claude-3-opus-20240229", Name: "Claude 3 Opus", ContextWindow: 200000, MaxTokens: 4096, Input: []string{"text", "image"}},
			{ID: "claude-3-haiku-20240307", Name: "Claude 3 Haiku", ContextWindow: 200000, MaxTokens: 4096, Input: []string{"text"}},
		},
		APIKeyURL: "https://console.anthropic.com/settings/keys",
		URL:       "https://www.anthropic.com/pricing",
		EnvVar:    "ANTHROPIC_API_KEY",
	},
	"openai": {
		ID:              "openai",
		Label:           "OpenAI",
		BaseURL:         "https://api.openai.com/v1",
		API:             "openai-completions",
		ValidationModel: "gpt-4o-mini",
		Models: []ModelInfo{
			{ID: "gpt-4o", Name: "GPT-4o", ContextWindow: 128000, MaxTokens: 16384, Input: []string{"text", "image"}},
			{ID: "gpt-4o-mini", Name: "GPT-4o Mini", ContextWindow: 128000, MaxTokens: 16384, Input: []string{"text", "image"}},
			{ID: "gpt-4-turbo", Name: "GPT-4 Turbo", ContextWindow: 128000, MaxTokens: 4096, Input: []string{"text", "image"}},
			{ID: "gpt-4", Name: "GPT-4", ContextWindow: 8192, MaxTokens: 4096, Input: []string{"text"}},
			{ID: "o1", Name: "o1", ContextWindow: 200000, MaxTokens: 100000, Input: []string{"text"}},
			{ID: "o1-mini", Name: "o1 Mini", ContextWindow: 128000, MaxTokens: 65536, Input: []string{"text"}},
		},
		APIKeyURL: "https://platform.openai.com/api-keys",
		URL:       "https://openai.com/api/pricing/",
		EnvVar:    "OPENAI_API_KEY",
	},
	"google": {
		ID:              "google",
		Label:           "Google (Gemini)",
		BaseURL:         "https://generativelanguage.googleapis.com/v1beta/openai",
		API:             "openai-completions",
		ValidationModel: "gemini-2.0-flash",
		Models: []ModelInfo{
			{ID: "gemini-2.5-pro-preview-06-05", Name: "Gemini 2.5 Pro", ContextWindow: 1048576, MaxTokens: 65536, Input: []string{"text", "image"}},
			{ID: "gemini-2.0-flash", Name: "Gemini 2.0 Flash", ContextWindow: 1048576, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "gemini-1.5-pro", Name: "Gemini 1.5 Pro", ContextWindow: 2097152, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "gemini-1.5-flash", Name: "Gemini 1.5 Flash", ContextWindow: 1048576, MaxTokens: 8192, Input: []string{"text", "image"}},
		},
		APIKeyURL: "https://aistudio.google.com/app/apikey",
		URL:       "https://ai.google.dev/pricing",
		EnvVar:    "GEMINI_API_KEY",
	},
	"deepseek": {
		ID:              "deepseek",
		Label:           "DeepSeek",
		BaseURL:         "https://api.deepseek.com",
		API:             "openai-completions",
		ValidationModel: "deepseek-chat",
		Models: []ModelInfo{
			{ID: "deepseek-chat", Name: "DeepSeek Chat (V3)", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "deepseek-reasoner", Name: "DeepSeek Reasoner (R1)", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "deepseek-coder", Name: "DeepSeek Coder", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://platform.deepseek.com/api_keys",
		URL:       "https://platform.deepseek.com/api-docs/pricing",
		EnvVar:    "DEEPSEEK_API_KEY",
	},
	"qwen": {
		ID:              "qwen",
		Label:           "Qwen (Bailian)",
		BaseURL:         "https://dashscope.aliyuncs.com/compatible-mode/v1",
		API:             "openai-completions",
		ValidationModel: "qwen-turbo",
		Models: []ModelInfo{
			{ID: "qwen-max", Name: "Qwen Max", ContextWindow: 32768, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwen-plus", Name: "Qwen Plus", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwen-turbo", Name: "Qwen Turbo", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwen-long", Name: "Qwen Long", ContextWindow: 10000000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwen3-235b-a22b", Name: "Qwen3 235B", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwen3-coder-plus", Name: "Qwen3 Coder Plus", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "qwq-plus", Name: "QwQ Plus", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://bailian.console.aliyun.com/#/model-market/api-key",
		URL:       "https://help.aliyun.com/zh/model-studio/getting-started/models",
		EnvVar:    "DASHSCOPE_API_KEY",
	},
	"qwen-coding": {
		ID:              "qwen-coding",
		Label:           "阿里云百炼 Coding Plan",
		BaseURL:         "https://coding.dashscope.aliyuncs.com/v1",
		API:             "openai-completions",
		ValidationModel: "qwen3.5-plus",
		Models: []ModelInfo{
			{ID: "qwen3.5-plus", Name: "Qwen3.5 Plus", ContextWindow: 1000000, MaxTokens: 65536, Input: []string{"text", "image"}},
			{ID: "qwen3-max-2026-01-23", Name: "Qwen3 Max", ContextWindow: 262144, MaxTokens: 65536, Input: []string{"text"}},
			{ID: "qwen3-coder-next", Name: "Qwen3 Coder Next", ContextWindow: 262144, MaxTokens: 65536, Input: []string{"text"}},
			{ID: "qwen3-coder-plus", Name: "Qwen3 Coder Plus", ContextWindow: 1000000, MaxTokens: 65536, Input: []string{"text"}},
			{ID: "MiniMax-M2.5", Name: "MiniMax M2.5", ContextWindow: 196608, MaxTokens: 32768, Input: []string{"text"}},
			{ID: "glm-5", Name: "GLM-5", ContextWindow: 202752, MaxTokens: 16384, Input: []string{"text"}},
			{ID: "glm-4.7", Name: "GLM-4.7", ContextWindow: 202752, MaxTokens: 16384, Input: []string{"text"}},
			{ID: "kimi-k2.5", Name: "Kimi K2.5", ContextWindow: 262144, MaxTokens: 32768, Input: []string{"text", "image"}},
		},
		APIKeyURL: "https://bailian.console.aliyun.com/cn-beijing/?tab=model#/efm/coding_plan",
		URL:       "https://www.aliyun.com/benefit/scene/codingplan",
		EnvVar:    "DASHSCOPE_CODING_API_KEY",
	},
	"zhipu": {
		ID:              "zhipu",
		Label:           "ZhipuAI (智谱)",
		BaseURL:         "https://open.bigmodel.cn/api/paas/v4",
		API:             "openai-completions",
		ValidationModel: "glm-4-flash",
		Models: []ModelInfo{
			{ID: "glm-5", Name: "GLM-5", ContextWindow: 202752, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4.7", Name: "GLM-4.7", ContextWindow: 204800, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4.7-flash", Name: "GLM-4.7-Flash", ContextWindow: 204800, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4.5", Name: "GLM-4.5", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4-plus", Name: "GLM-4 Plus", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4-flash", Name: "GLM-4 Flash", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://open.bigmodel.cn/usercenter/apikeys",
		URL:       "https://open.bigmodel.cn/pricing",
		EnvVar:    "ZHIPU_API_KEY",
	},
	"moonshot": {
		ID:              "moonshot",
		Label:           "Moonshot (Kimi)",
		BaseURL:         "https://api.moonshot.ai/v1",
		API:             "openai-completions",
		ValidationModel: "moonshot-v1-32k",
		Models: []ModelInfo{
			{ID: "kimi-k2.5", Name: "Kimi K2.5", ContextWindow: 262144, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "kimi-k2-thinking", Name: "Kimi K2 Thinking", ContextWindow: 262144, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "moonshot-v1-128k", Name: "Moonshot V1 128K", ContextWindow: 128000, MaxTokens: 4096, Input: []string{"text"}},
			{ID: "moonshot-v1-32k", Name: "Moonshot V1 32K", ContextWindow: 32000, MaxTokens: 4096, Input: []string{"text"}},
		},
		APIKeyURL: "https://platform.moonshot.ai/console/api-keys",
		URL:       "https://platform.moonshot.ai/docs/pricing/chat",
		EnvVar:    "MOONSHOT_API_KEY",
	},
	"kimi": {
		ID:              "kimi",
		Label:           "Kimi",
		BaseURL:         "https://api.moonshot.cn/v1",
		API:             "openai-completions",
		ValidationModel: "moonshot-v1-32k",
		Models: []ModelInfo{
			{ID: "kimi-k2.5", Name: "Kimi K2.5", ContextWindow: 262144, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "moonshot-v1-128k", Name: "Moonshot V1 128K", ContextWindow: 128000, MaxTokens: 4096, Input: []string{"text"}},
			{ID: "moonshot-v1-32k", Name: "Moonshot V1 32K", ContextWindow: 32000, MaxTokens: 4096, Input: []string{"text"}},
		},
		APIKeyURL: "https://platform.moonshot.cn/console/api-keys",
		URL:       "https://platform.moonshot.cn/docs/pricing/chat",
		EnvVar:    "KIMI_API_KEY",
	},
	"modelscope": {
		ID:              "modelscope",
		Label:           "ModelScope (魔搭)",
		BaseURL:         "https://api-inference.modelscope.cn/v1",
		API:             "openai-completions",
		ValidationModel: "Qwen/Qwen3.5-397B-A17B",
		Models: []ModelInfo{
			{ID: "Qwen/Qwen3.5-397B-A17B", Name: "Qwen3.5 397B", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "Qwen/Qwen3-235B-A22B-Instruct-2507", Name: "Qwen3 235B Instruct", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "deepseek-ai/DeepSeek-R1-0528", Name: "DeepSeek R1", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://modelscope.cn/my/myaccesstoken",
		URL:       "https://modelscope.cn/docs/model-service/API-Inference/intro",
		EnvVar:    "MODELSCOPE_API_KEY",
	},
	"zai": {
		ID:              "zai",
		Label:           "Z.ai (GLM)",
		BaseURL:         "https://api.z.ai/api/paas/v4",
		API:             "openai-completions",
		ValidationModel: "glm-4.7-flash",
		Models: []ModelInfo{
			{ID: "glm-4.7-flash", Name: "GLM-4.7-Flash", ContextWindow: 204800, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "glm-4.5", Name: "GLM-4.5", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://open.bigmodel.cn/usercenter/apikeys",
		URL:       "https://docs.z.ai/guides/overview/pricing",
		EnvVar:    "ZAI_API_KEY",
	},
}
// GetProviderMeta returns provider metadata by ID
func GetProviderMeta(providerID string) *ProviderMeta {
	if meta, ok := builtinProviders[providerID]; ok {
		return &meta
	}
	return nil
}
// GetAllProviders returns all built-in provider metadata
func GetAllProviders() map[string]ProviderMeta {
	return builtinProviders
}
// IsBuiltInProvider checks if a provider is a built-in provider
func IsBuiltInProvider(providerID string) bool {
	_, ok := builtinProviders[providerID]
	return ok
}