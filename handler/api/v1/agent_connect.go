package v1

import (
	"context"
	"strings"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
)

type AgentConnectResponse struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Status     model.AgentStatus `json:"status"`
	Ready      bool              `json:"ready"`
	Token      string            `json:"token,omitempty"`
	Endpoint   string            `json:"endpoint,omitempty"`
	WsURL      string            `json:"ws_url,omitempty"`
	WebChatURL string            `json:"webchat_url,omitempty"`
}

func GetAgentConnect(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	response := AgentConnectResponse{
		ID:     agent.ID,
		Name:   agent.Name,
		Status: agent.Status,
		Token:  agent.ID, // Token is agent ID
	}

	if agent.Status != model.AgentStatusRunning {
		return util.Success(c, response)
	}

	ctx := context.Background()

	// Check if deployment is ready
	ready, err := k8s.GetDeploymentStatus(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to get deployment status")
	}
	response.Ready = ready

	// Get service endpoint (internal)
	endpoint, err := k8s.GetServiceEndpoint(ctx, agent.ID)
	if err != nil {
		return util.InternalError(c, "failed to get service endpoint")
	}
	response.Endpoint = endpoint

	// Build external URL based on domain template
	if ready {
		serviceName := k8s.GetServiceName(agent.ID)
		namespace := k8s.GetNamespace()

		// Get domain template from config
		domainTemplate := viper.GetString("domain.bot_domain_template")

		// Replace placeholders
		externalURL := strings.ReplaceAll(domainTemplate, "{bot_id}", agent.ID)
		externalURL = strings.ReplaceAll(externalURL, "{service_name}", serviceName)
		externalURL = strings.ReplaceAll(externalURL, "{namespace}", namespace)

		response.WebChatURL = externalURL
		response.WsURL = strings.Replace(externalURL, "http://", "ws://", 1)
		response.WsURL = strings.Replace(response.WsURL, "https://", "wss://", 1)
	}

	return util.Success(c, response)
}
