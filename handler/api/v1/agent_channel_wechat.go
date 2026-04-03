package v1

import (
	"encoding/json"
	"fmt"
	"io"
	"context"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

const (
	weixinAPIBaseURL = "https://ilinkai.weixin.qq.com"
	weixinBotType    = "3"
	weixinChannelID  = "openclaw-weixin"
	weixinQRTTL      = 5 * time.Minute
)

// weixinLoginSession tracks an active QR login session
type weixinLoginSession struct {
	AgentID   string
	Name      string // optional friendly name for the account
	QRCode    string // opaque token for polling status
	QRCodeURL string // image URL for the QR code
	CreatedAt time.Time
}

var (
	weixinSessionsMu sync.Mutex
	weixinSessions   = make(map[string]*weixinLoginSession) // agentID -> session
)

// ilink API response types
type ilinkQRCodeResponse struct {
	QRCode         string `json:"qrcode"`
	QRCodeImgURL   string `json:"qrcode_img_content"`
}

type ilinkQRStatusResponse struct {
	Status      string `json:"status"` // wait, scaned, confirmed, expired
	BotToken    string `json:"bot_token,omitempty"`
	IlinkBotID  string `json:"ilink_bot_id,omitempty"`
	BaseURL     string `json:"baseurl,omitempty"`
	IlinkUserID string `json:"ilink_user_id,omitempty"`
}

// WechatLoginStart initiates a WeChat QR code login for an agent.
// POST /api/v1/agents/:id/channels/wechat/login
func WechatLoginStart(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}
	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	// Optional friendly name for the account
	var body struct {
		Name string `json:"name"`
	}
	c.Bind(&body)

	// Fetch QR code from ilink API
	qrResp, err := fetchWeixinQRCode()
	if err != nil {
		return util.InternalError(c, "failed to get QR code: "+err.Error())
	}

	// Store session for status polling
	weixinSessionsMu.Lock()
	weixinSessions[agent.ID] = &weixinLoginSession{
		AgentID:   agent.ID,
		Name:      body.Name,
		QRCode:    qrResp.QRCode,
		QRCodeURL: qrResp.QRCodeImgURL,
		CreatedAt: time.Now(),
	}
	weixinSessionsMu.Unlock()

	return util.Success(c, map[string]any{
		"qrcode_url": qrResp.QRCodeImgURL,
		"message":    "\u4f7f\u7528\u5fae\u4fe1\u626b\u63cf\u4e8c\u7ef4\u7801\uff0c\u4ee5\u5b8c\u6210\u8fde\u63a5\u3002",
	})
}

// WechatLoginStatus polls the QR code scan status.
// GET /api/v1/agents/:id/channels/wechat/login/status
func WechatLoginStatus(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	// Get active session
	weixinSessionsMu.Lock()
	session := weixinSessions[agent.ID]
	weixinSessionsMu.Unlock()

	if session == nil {
		return util.BadRequest(c, "no active login session, call login first")
	}

	// Check if expired locally
	if time.Since(session.CreatedAt) > weixinQRTTL {
		weixinSessionsMu.Lock()
		delete(weixinSessions, agent.ID)
		weixinSessionsMu.Unlock()
		return util.Success(c, map[string]any{
			"status":    "expired",
			"connected": false,
			"message":   "\u4e8c\u7ef4\u7801\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u83b7\u53d6\u3002",
		})
	}

	// Poll ilink API for status
	statusResp, err := pollWeixinQRStatus(session.QRCode)
	if err != nil {
		return util.InternalError(c, "failed to poll status: "+err.Error())
	}

	switch statusResp.Status {
	case "confirmed":
		// Clean up session
		weixinSessionsMu.Lock()
		delete(weixinSessions, agent.ID)
		weixinSessionsMu.Unlock()

		// Write credentials to agent pod (synchronous to ensure config is ready before frontend refresh)
		if statusResp.BotToken != "" && statusResp.IlinkBotID != "" {
			writeWechatCredentials(agent, statusResp, session.Name)
		}

		return util.Success(c, map[string]any{
			"status":     "confirmed",
			"connected":  true,
			"account_id": statusResp.IlinkBotID,
			"message":    "\u5fae\u4fe1\u8fde\u63a5\u6210\u529f\uff01",
		})

	case "scaned":
		return util.Success(c, map[string]any{
			"status":    "scaned",
			"connected": false,
			"message":   "\u5df2\u626b\u7801\uff0c\u8bf7\u5728\u5fae\u4fe1\u4e0a\u786e\u8ba4\u767b\u5f55\u3002",
		})

	case "expired":
		weixinSessionsMu.Lock()
		delete(weixinSessions, agent.ID)
		weixinSessionsMu.Unlock()
		return util.Success(c, map[string]any{
			"status":    "expired",
			"connected": false,
			"message":   "\u4e8c\u7ef4\u7801\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u83b7\u53d6\u3002",
		})

	default: // "wait"
		return util.Success(c, map[string]any{
			"status":    "wait",
			"connected": false,
			"message":   "\u7b49\u5f85\u626b\u7801...",
		})
	}
}

// fetchWeixinQRCode calls the ilink API to get a new QR code
func fetchWeixinQRCode() (*ilinkQRCodeResponse, error) {
	apiURL := fmt.Sprintf("%s/ilink/bot/get_bot_qrcode?bot_type=%s", weixinAPIBaseURL, weixinBotType)

	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, string(body))
	}

	var qrResp ilinkQRCodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&qrResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if qrResp.QRCode == "" {
		return nil, fmt.Errorf("empty QR code in response")
	}

	return &qrResp, nil
}

// pollWeixinQRStatus polls the ilink API for QR code scan status
func pollWeixinQRStatus(qrcode string) (*ilinkQRStatusResponse, error) {
	apiURL := fmt.Sprintf("%s/ilink/bot/get_qrcode_status?qrcode=%s",
		weixinAPIBaseURL, url.QueryEscape(qrcode))

	client := &http.Client{Timeout: 40 * time.Second} // long-poll timeout
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, string(body))
	}

	var statusResp ilinkQRStatusResponse
	if err := json.Unmarshal(body, &statusResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &statusResp, nil
}

// normalizeAccountID converts raw account ID to filesystem-safe format
// e.g. "161325c4c670@im.bot" -> "161325c4c670-im-bot"
func normalizeAccountID(raw string) string {
	s := strings.ReplaceAll(raw, "@", "-")
	s = strings.ReplaceAll(s, ".", "-")
	return s
}

// writeWechatCredentials writes credential files to the agent's pod.
// The plugin reads credentials from these files, NOT from openclaw.json.
func writeWechatCredentials(agent *model.Agent, status *ilinkQRStatusResponse, name string) {
	ctx := context.Background()

	baseURL := status.BaseURL
	if baseURL == "" {
		baseURL = weixinAPIBaseURL
	}

	normalizedID := normalizeAccountID(status.IlinkBotID)

	podName, err := k8s.GetPodName(ctx, agent.ID)
	if err != nil {
		fmt.Printf("[Wechat] Failed to get pod: %v\n", err)
		return
	}
	ns := k8s.GetNamespace()

	// 1. Write credential file: ~/.openclaw/openclaw-weixin/accounts/{normalizedID}.json
	nameField := ""
	if name != "" {
		nameField = fmt.Sprintf(`,"name":"%s"`, name)
	}
	credJSON := fmt.Sprintf(`{"token":"%s","savedAt":"%s","baseUrl":"%s","userId":"%s"%s}`,
		status.BotToken, time.Now().UTC().Format(time.RFC3339), baseURL, status.IlinkUserID, nameField)
	credCmd := fmt.Sprintf(
		`mkdir -p /home/node/.openclaw/openclaw-weixin/accounts && cat > /home/node/.openclaw/openclaw-weixin/accounts/%s.json << 'EOF'
%s
EOF
chmod 600 /home/node/.openclaw/openclaw-weixin/accounts/%s.json`,
		normalizedID, credJSON, normalizedID)
	if _, err := k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", credCmd}); err != nil {
		fmt.Printf("[Wechat] Failed to write credential file: %v\n", err)
		return
	}

	// 2. Update account index: ~/.openclaw/openclaw-weixin/accounts.json
	indexCmd := fmt.Sprintf(`node -e "
const fs = require('fs');
const f = '/home/node/.openclaw/openclaw-weixin/accounts.json';
let ids = [];
try { ids = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
if (!ids.includes('%s')) { ids.push('%s'); fs.writeFileSync(f, JSON.stringify(ids, null, 2)); }
"`, normalizedID, normalizedID)
	if _, err := k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", indexCmd}); err != nil {
		fmt.Printf("[Wechat] Failed to update account index: %v\n", err)
		return
	}

	// 3. Write account entry to openclaw.json and trigger channel reload
	triggerCmd := fmt.Sprintf(`node -e "
const fs = require('fs');
const f = '/home/node/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
if (!c.channels) c.channels = {};
if (!c.channels['openclaw-weixin']) c.channels['openclaw-weixin'] = {};
c.channels['openclaw-weixin'].enabled = true;
if (!c.channels['openclaw-weixin'].accounts) c.channels['openclaw-weixin'].accounts = {};
c.channels['openclaw-weixin'].accounts['%s'] = {};
fs.writeFileSync(f, JSON.stringify(c, null, 2));
"`, normalizedID)
	if _, err := k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", triggerCmd}); err != nil {
		fmt.Printf("[Wechat] Failed to trigger reload: %v\n", err)
	}

	fmt.Printf("[Wechat] Credentials written for agent %s, account=%s\n", agent.ID, normalizedID)
}

// WechatListAccounts lists all connected WeChat accounts for an agent.
// GET /api/v1/agents/:id/channels/wechat/accounts
func WechatListAccounts(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}
	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	ctx := context.Background()
	podName, err := k8s.GetPodName(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to get pod: "+err.Error())
	}

	// Read account index and credential files
	output, err := k8s.ExecInPod(ctx, k8s.GetNamespace(), podName, "openclaw", []string{"sh", "-c", `node -e "
const fs = require('fs');
const indexFile = '/home/node/.openclaw/openclaw-weixin/accounts.json';
const accountsDir = '/home/node/.openclaw/openclaw-weixin/accounts';
let ids = [];
try { ids = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch {}
const accounts = ids.map(id => {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(accountsDir + '/' + id + '.json', 'utf8')); } catch {}
  return {
    account_id: id,
    name: data.name || id,
    base_url: data.baseUrl || '',
    user_id: data.userId || '',
    saved_at: data.savedAt || '',
    configured: Boolean(data.token)
  };
});
console.log(JSON.stringify(accounts));
"`})
	if err != nil {
		// No accounts yet
		return util.Success(c, map[string]any{
			"channel":  weixinChannelID,
			"accounts": []any{},
		})
	}

	var accounts []any
	if err := json.Unmarshal([]byte(strings.TrimSpace(output)), &accounts); err != nil {
		return util.Success(c, map[string]any{
			"channel":  weixinChannelID,
			"accounts": []any{},
		})
	}

	return util.Success(c, map[string]any{
		"channel":  weixinChannelID,
		"accounts": accounts,
	})
}

// WechatRemoveAccount removes a specific WeChat account from an agent.
// DELETE /api/v1/agents/:id/channels/wechat/accounts/:account_id
func WechatRemoveAccount(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}
	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	accountID := c.Param("account_id")
	if accountID == "" {
		return util.BadRequest(c, "account_id is required")
	}

	ctx := context.Background()
	podName, err := k8s.GetPodName(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to get pod: "+err.Error())
	}
	ns := k8s.GetNamespace()

	// 1. Remove credential file
	credCmd := fmt.Sprintf(`rm -f /home/node/.openclaw/openclaw-weixin/accounts/%s.json /home/node/.openclaw/openclaw-weixin/accounts/%s.sync.json`, accountID, accountID)
	k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", credCmd})

	// 2. Remove from account index
	indexCmd := fmt.Sprintf(`node -e "
const fs = require('fs');
const f = '/home/node/.openclaw/openclaw-weixin/accounts.json';
try {
  let ids = JSON.parse(fs.readFileSync(f, 'utf8'));
  ids = ids.filter(id => id !== '%s');
  fs.writeFileSync(f, JSON.stringify(ids, null, 2));
} catch {}
"`, accountID)
	k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", indexCmd})

	// 3. Remove account from openclaw.json config; if no accounts left, remove entire channel
	configCmd := fmt.Sprintf(`node -e "
const fs = require('fs');
const f = '/home/node/.openclaw/openclaw.json';
try {
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (c.channels && c.channels['openclaw-weixin']) {
    const ch = c.channels['openclaw-weixin'];
    if (ch.accounts) {
      delete ch.accounts['%s'];
      if (Object.keys(ch.accounts).length === 0) {
        delete c.channels['openclaw-weixin'];
      }
    } else {
      delete c.channels['openclaw-weixin'];
    }
    fs.writeFileSync(f, JSON.stringify(c, null, 2));
  }
} catch {}
"`, accountID)
	k8s.ExecInPod(ctx, ns, podName, "openclaw", []string{"sh", "-c", configCmd})

	return util.Success(c, map[string]any{
		"message":    "WeChat account removed",
		"channel":    weixinChannelID,
		"account_id": accountID,
	})
}
