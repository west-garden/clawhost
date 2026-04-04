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
	"groq": {
		ID:              "groq",
		Label:           "Groq",
		BaseURL:         "https://api.groq.com/openai/v1",
		API:             "openai-completions",
		ValidationModel: "llama-3.3-70b-versatile",
		Models: []ModelInfo{
			{ID: "llama-3.3-70b-versatile", Name: "Llama 3.3 70B", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "llama-3.1-8b-instant", Name: "Llama 3.1 8B", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "mixtral-8x7b-32768", Name: "Mixtral 8x7B", ContextWindow: 32768, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://console.groq.com/keys",
		URL:       "https://groq.com/pricing/",
		EnvVar:    "GROQ_API_KEY",
	},
	"mistral": {
		ID:              "mistral",
		Label:           "Mistral",
		BaseURL:         "https://api.mistral.ai/v1",
		API:             "openai-completions",
		ValidationModel: "mistral-small-latest",
		Models: []ModelInfo{
			{ID: "mistral-large-latest", Name: "Mistral Large", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "mistral-medium-latest", Name: "Mistral Medium", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "mistral-small-latest", Name: "Mistral Small", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "codestral-latest", Name: "Codestral", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://console.mistral.ai/api-keys/",
		URL:       "https://mistral.ai/pricing/",
		EnvVar:    "MISTRAL_API_KEY",
	},
	"xai": {
		ID:              "xai",
		Label:           "xAI (Grok)",
		BaseURL:         "https://api.x.ai/v1",
		API:             "openai-completions",
		ValidationModel: "grok-2-latest",
		Models: []ModelInfo{
			{ID: "grok-3-latest", Name: "Grok 3", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "grok-2-latest", Name: "Grok 2", ContextWindow: 131072, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "grok-2-vision-latest", Name: "Grok 2 Vision", ContextWindow: 32768, MaxTokens: 8192, Input: []string{"text", "image"}},
		},
		APIKeyURL: "https://console.x.ai/",
		URL:       "https://x.ai/api",
		EnvVar:    "XAI_API_KEY",
	},
	"openrouter": {
		ID:              "openrouter",
		Label:           "OpenRouter",
		BaseURL:         "https://openrouter.ai/api/v1",
		API:             "openai-completions",
		ValidationModel: "anthropic/claude-3.5-haiku",
		Models: []ModelInfo{
			{ID: "anthropic/claude-sonnet-4", Name: "Claude Sonnet 4 (via OpenRouter)", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "anthropic/claude-3.5-sonnet", Name: "Claude 3.5 Sonnet (via OpenRouter)", ContextWindow: 200000, MaxTokens: 8192, Input: []string{"text", "image"}},
			{ID: "openai/gpt-4o", Name: "GPT-4o (via OpenRouter)", ContextWindow: 128000, MaxTokens: 16384, Input: []string{"text", "image"}},
		},
		APIKeyURL: "https://openrouter.ai/keys",
		URL:       "https://openrouter.ai/models",
		EnvVar:    "OPENROUTER_API_KEY",
	},
	"nvidia": {
		ID:              "nvidia",
		Label:           "NVIDIA (NIM)",
		BaseURL:         "https://integrate.api.nvidia.com/v1",
		API:             "openai-completions",
		ValidationModel: "meta/llama-3.3-70b-instruct",
		Models: []ModelInfo{
			{ID: "meta/llama-3.3-70b-instruct", Name: "Llama 3.3 70B", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "meta/llama-3.1-405b-instruct", Name: "Llama 3.1 405B", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "deepseek-ai/deepseek-r1", Name: "DeepSeek R1", ContextWindow: 128000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://build.nvidia.com/api-key",
		URL:       "https://build.nvidia.com/explore/discover/models",
		EnvVar:    "NVIDIA_API_KEY",
	},
	"minimax": {
		ID:              "minimax",
		Label:           "MiniMax",
		BaseURL:         "https://api.minimax.chat/v1",
		API:             "openai-completions",
		ValidationModel: "MiniMax-Text-01",
		Models: []ModelInfo{
			{ID: "MiniMax-Text-01", Name: "MiniMax Text 01", ContextWindow: 1000000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "abab6.5s-chat", Name: "ABAB 6.5S", ContextWindow: 245000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://www.minimaxi.com/user-center/basic-information/interface-key",
		URL:       "https://www.minimaxi.com/document/",
		EnvVar:    "MINIMAX_API_KEY",
	},
	"minimax-cn": {
		ID:              "minimax-cn",
		Label:           "MiniMax (国内)",
		BaseURL:         "https://api.minimaxi.com/v1",
		API:             "openai-completions",
		ValidationModel: "MiniMax-Text-01",
		Models: []ModelInfo{
			{ID: "MiniMax-Text-01", Name: "MiniMax Text 01", ContextWindow: 1000000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "abab6.5s-chat", Name: "ABAB 6.5S", ContextWindow: 245000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://www.minimaxi.com/user-center/basic-information/interface-key",
		URL:       "https://www.minimaxi.com/document/",
		EnvVar:    "MINIMAX_CN_API_KEY",
	},
	"volcengine": {
		ID:              "volcengine",
		Label:           "火山引擎 (豆包)",
		BaseURL:         "https://ark.cn-beijing.volces.com/api/v3",
		API:             "openai-completions",
		ValidationModel: "doubao-seed-1-6-250415",
		Models: []ModelInfo{
			{ID: "doubao-seed-1-6-250415", Name: "Doubao Seed 1.6", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "doubao-pro-32k-240828", Name: "Doubao Pro 32K", ContextWindow: 32768, MaxTokens: 8192, Input: []string{"text"}},
			{ID: "doubao-pro-256k-240828", Name: "Doubao Pro 256K", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
		URL:       "https://www.volcengine.com/docs/82379/1099320",
		EnvVar:    "VOLCENGINE_API_KEY",
	},
	"xiaomi": {
		ID:              "xiaomi",
		Label:           "小米 (MiMo)",
		BaseURL:         "https://api.xiaomimimo.com/v1",
		API:             "openai-completions",
		ValidationModel: "MiMo-7B-RL",
		Models: []ModelInfo{
			{ID: "MiMo-7B-RL", Name: "MiMo 7B RL", ContextWindow: 32768, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://xiaomimimo.com/",
		URL:       "https://xiaomimimo.com/",
		EnvVar:    "XIAOMI_API_KEY",
	},
	"moonshot-coding": {
		ID:              "moonshot-coding",
		Label:           "Kimi Code",
		BaseURL:         "https://api.kimi.com/coding",
		API:             "anthropic-messages",
		ValidationModel: "kimi-k2.5",
		Models: []ModelInfo{
			{ID: "kimi-k2.5", Name: "Kimi K2.5", ContextWindow: 262144, MaxTokens: 32768, Input: []string{"text", "image"}},
			{ID: "kimi-k2-thinking", Name: "Kimi K2 Thinking", ContextWindow: 262144, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://platform.moonshot.cn/console/api-keys",
		URL:       "https://platform.moonshot.cn/docs/pricing/chat",
		EnvVar:    "MOONSHOT_CODING_API_KEY",
	},
	"minimax-coding": {
		ID:              "minimax-coding",
		Label:           "MiniMax Coding Plan",
		BaseURL:         "https://api.minimaxi.com/v1",
		API:             "openai-completions",
		ValidationModel: "MiniMax-Text-01",
		Models: []ModelInfo{
			{ID: "MiniMax-Text-01", Name: "MiniMax Text 01", ContextWindow: 1000000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://www.minimaxi.com/user-center/basic-information/interface-key",
		URL:       "https://www.minimaxi.com/document/",
		EnvVar:    "MINIMAX_CODING_API_KEY",
	},
	"volcengine-coding": {
		ID:              "volcengine-coding",
		Label:           "火山引擎 Coding Plan",
		BaseURL:         "https://ark.cn-beijing.volces.com/api/coding/v3",
		API:             "openai-completions",
		ValidationModel: "doubao-seed-1-6-250415",
		Models: []ModelInfo{
			{ID: "doubao-seed-1-6-250415", Name: "Doubao Seed 1.6", ContextWindow: 256000, MaxTokens: 8192, Input: []string{"text"}},
		},
		APIKeyURL: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
		URL:       "https://www.volcengine.com/docs/82379/1099320",
		EnvVar:    "VOLCENGINE_CODING_API_KEY",
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