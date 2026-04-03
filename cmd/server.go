package cmd

import (
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strings"

	v1 "github.com/clawhost/clawhost/handler/api/v1"
	"github.com/clawhost/clawhost/handler/proxy"
	authmw "github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/web"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start the API server",
	Run: func(cmd *cobra.Command, args []string) {
		if err := initConfig(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}

		if err := k8s.InitClient(); err != nil {
			log.Fatalf("init k8s client failed: %v", err)
		}

		// Create initial admin user if configured
		if err := model.CreateInitialAdmin(); err != nil {
			log.Printf("warning: failed to create initial admin: %v", err)
		}

		startServer()
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)
}

func startServer() {
	e := echo.New()

	// Get API domain to exclude from subdomain routing
	apiDomain := viper.GetString("domain.api_domain")

	// Subdomain routing middleware (must run BEFORE routing with e.Pre)
	// {agent-id}.any-domain/* -> /proxy/{agent-id}/*
	e.Pre(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			host := c.Request().Host
			// Remove port if present
			if idx := strings.Index(host, ":"); idx > 0 {
				host = host[:idx]
			}

			// Skip IP addresses (e.g., K8s health checks via pod IP)
			if net.ParseIP(host) != nil {
				return next(c)
			}

			// Skip if this is the API domain itself (no subdomain)
			if host == apiDomain {
				return next(c)
			}

			// Skip internal Kubernetes service DNS (*.svc.cluster.local)
			if strings.HasSuffix(host, ".svc.cluster.local") {
				return next(c)
			}

			// Extract first subdomain segment as agent ID
			if dotIdx := strings.Index(host, "."); dotIdx > 0 {
				agentID := host[:dotIdx]
				if agentID != "" {
					path := c.Request().URL.Path
					c.Request().URL.Path = "/proxy/" + agentID + path
					return next(c)
				}
			}

			return next(c)
		}
	})

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			// Allow localhost for development
			if strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") {
				return true, nil
			}
			// Allow same-origin (empty origin for same-origin requests)
			if origin == "" {
				return true, nil
			}
			// In production, check against configured domain
			apiDomain := viper.GetString("domain.api_domain")
			if apiDomain != "" && strings.HasSuffix(origin, apiDomain) {
				return true, nil
			}
			return false, nil
		},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Auth routes (no auth required)
	auth := e.Group("/auth")
	auth.POST("/register", v1.Register)
	auth.POST("/login", v1.Login)
	auth.POST("/refresh", v1.Refresh)
	auth.GET("/oauth/:provider", v1.OAuthRedirect)
	auth.GET("/oauth/:provider/callback", v1.OAuthCallback)

	// Auth routes requiring JWT
	authProtected := e.Group("/auth")
	authProtected.Use(authmw.JWTAuth())
	authProtected.GET("/me", v1.GetProfile)
	authProtected.PUT("/me", v1.UpdateProfile)
	authProtected.PUT("/me/password", v1.ChangePassword)
	authProtected.POST("/logout", v1.Logout)

	// API routes: /api/v1/*
	api := e.Group("/api/v1")
	api.Use(authmw.JWTAuth()) // JWT authentication
	{
		// Agent collection routes (no ownership check needed)
		api.POST("/agents", v1.CreateAgent)
		api.GET("/agents", v1.ListAgents)
	}

	// Agent instance routes: require ownership validation
	agentAPI := api.Group("/agents/:id")
	agentAPI.Use(authmw.AgentOwnerAuth()) // Verify authenticated user owns the agent
	{
		// Agent CRUD
		agentAPI.GET("", v1.GetAgent)
		agentAPI.PUT("", v1.UpdateAgent)
		agentAPI.DELETE("", v1.DeleteAgent)

		// Agent lifecycle
		agentAPI.POST("/start", v1.StartAgent)
		agentAPI.POST("/stop", v1.StopAgent)
		agentAPI.POST("/restart", v1.RestartAgent)
		agentAPI.GET("/status", v1.GetAgentStatus)
		agentAPI.GET("/connect", v1.GetAgentConnect)
		agentAPI.POST("/reset-token", v1.ResetAgentToken)

		// Skills management
		agentAPI.GET("/skills", v1.ListSkills)
		agentAPI.PUT("/skills/:name", v1.UpdateSkill)
		agentAPI.DELETE("/skills/:name", v1.DeleteSkill)

		// Channels management (IM integrations)
		agentAPI.POST("/channels", v1.AddChannel)
		agentAPI.GET("/channels", v1.ListChannels)
		agentAPI.DELETE("/channels/:channel", v1.RemoveChannel)

		// Channel pairing management
		agentAPI.GET("/channels/:channel/pairing", v1.ListChannelPairingRequests)
		agentAPI.POST("/channels/:channel/pairing/approve", v1.ApproveChannelPairing)
		agentAPI.POST("/channels/:channel/pairing/revoke", v1.RevokeChannelPairing)
		agentAPI.GET("/channels/:channel/pairing/users", v1.GetChannelPairedUsers)

		// WeChat channel management (QR code login + multi-account)
		agentAPI.POST("/channels/wechat/login", v1.WechatLoginStart)
		agentAPI.GET("/channels/wechat/login/status", v1.WechatLoginStatus)
		agentAPI.GET("/channels/wechat/accounts", v1.WechatListAccounts)
		agentAPI.DELETE("/channels/wechat/accounts/:account_id", v1.WechatRemoveAccount)

		// Device pairing management
		agentAPI.GET("/devices", v1.ListDevices)
		agentAPI.POST("/devices/:request_id/approve", v1.ApproveDevice)
		agentAPI.DELETE("/devices/:device_id", v1.RevokeDevice)

		// Model providers management
		agentAPI.GET("/config/models", v1.ListModelProviders)
		agentAPI.POST("/config/models", v1.AddModelProvider)
		agentAPI.GET("/config/models/:provider", v1.GetModelProvider)
		agentAPI.PUT("/config/models/:provider", v1.UpdateModelProvider)
		agentAPI.DELETE("/config/models/:provider", v1.DeleteModelProvider)

		// Agent defaults management
		agentAPI.GET("/config/defaults", v1.GetAgentDefaults)
		agentAPI.PUT("/config/defaults", v1.SetAgentDefaults)

		// Raw openclaw.json config (read/write from running pod)
		agentAPI.GET("/config/raw", v1.GetAgentRawConfig)
		agentAPI.PUT("/config/raw", v1.UpdateAgentRawConfig)
	}

	// Admin API routes: /api/v1/admin/* (requires JWT + admin role)
	admin := e.Group("/api/v1/admin")
	admin.Use(authmw.JWTAuth())
	admin.Use(authmw.AdminAuth())
	{
		// User management
		admin.GET("/users", v1.ListUsersAdmin)
		admin.PUT("/users/:id", v1.UpdateUserAdmin)

		// Agent overview and stats
		admin.GET("/agents", v1.ListAllAgentsAdmin)
		admin.GET("/stats", v1.GetStats)

		// Agent upgrade management
		admin.POST("/agents/upgrade", v1.UpgradeAllAgents)
		admin.POST("/agents/:id/upgrade", v1.UpgradeAgent)

		// Agent restart management (full pod spec rebuild)
		admin.POST("/agents/restart", v1.RestartAllAgents)
	}

	// Subscription routes (public, requires JWT)
	subAPI := api.Group("/subscription")
	{
		subAPI.GET("/plans", v1.ListSubscriptionPlans)
		subAPI.GET("/credit-packs", v1.ListCreditPacks)
		subAPI.GET("/me", v1.GetMySubscription)
	}

	// Admin subscription routes
	adminSub := admin.Group("/subscription")
	{
		adminSub.GET("/plans", v1.AdminListPlans)
		adminSub.POST("/plans", v1.AdminCreatePlan)
		adminSub.PUT("/plans/:id", v1.AdminUpdatePlan)
		adminSub.GET("/credit-packs", v1.AdminListCreditPacks)
		adminSub.POST("/credit-packs", v1.AdminCreateCreditPack)
		adminSub.PUT("/credit-packs/:id", v1.AdminUpdateCreditPack)
		adminSub.POST("/grant", v1.AdminGrantSubscription)
	}

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Admin UI (served from embedded Next.js static export)
	adminFS, err := fs.Sub(web.AdminFS, "admin/out")
	if err != nil {
		log.Printf("Warning: admin UI not available: %v", err)
	} else {
		adminHandler := http.FileServer(http.FS(adminFS))
		e.GET("/admin/*", echo.WrapHandler(http.StripPrefix("/admin", adminHandler)))
		e.GET("/admin", func(c echo.Context) error {
			return c.Redirect(301, "/admin/")
		})
	}

	// Agent proxy routes (for {agent_id}.clawhost.ai/*)
	e.Any("/proxy/:agent_id", proxy.ProxyToAgent)
	e.Any("/proxy/:agent_id/*", proxy.ProxyToAgent)

	port := viper.GetInt("server.port")
	if port == 0 {
		port = 8080
	}

	log.Printf("Starting server on port %d", port)
	log.Printf("Admin UI: http://localhost:%d/admin", port)
	e.Logger.Fatal(e.Start(fmt.Sprintf(":%d", port)))
}
