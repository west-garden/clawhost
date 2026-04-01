// handler/api/v1/auth.go
package v1

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type UpdateProfileRequest struct {
	Name   string `json:"name,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// issueTokens generates access + refresh tokens for a user.
func issueTokens(user *model.User) (map[string]interface{}, error) {
	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token
	rawRefresh := model.GenerateRandomToken(32)
	ttl := viper.GetDuration("auth.jwt_refresh_ttl")
	if ttl == 0 {
		ttl = 7 * 24 * time.Hour
	}

	rt := &model.RefreshToken{
		UserID:    user.ID,
		TokenHash: model.HashToken(rawRefresh),
		ExpiresAt: time.Now().Add(ttl),
	}
	if err := model.CreateRefreshToken(rt); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": rawRefresh,
		"user":          user,
	}, nil
}

func Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return util.BadRequest(c, "email, password, and name are required")
	}
	if len(req.Password) < 8 {
		return util.BadRequest(c, "password must be at least 8 characters")
	}

	// Check if email already exists
	if _, err := model.GetUserByEmail(req.Email); err == nil {
		return util.BadRequest(c, "email already registered")
	}

	user := &model.User{
		Email: req.Email,
		Name:  req.Name,
	}
	if err := user.SetPassword(req.Password); err != nil {
		return util.InternalError(c, "failed to process password")
	}
	if err := model.CreateUser(user); err != nil {
		return util.InternalError(c, "failed to create user")
	}

	tokens, err := issueTokens(user)
	if err != nil {
		return util.InternalError(c, "failed to generate tokens")
	}
	return util.Success(c, tokens)
}

func Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.Email == "" || req.Password == "" {
		return util.BadRequest(c, "email and password are required")
	}

	user, err := model.GetUserByEmail(req.Email)
	if err != nil {
		return util.Unauthorized(c, "invalid email or password")
	}
	if !user.CheckPassword(req.Password) {
		return util.Unauthorized(c, "invalid email or password")
	}

	// Clean up expired tokens on login
	model.DeleteExpiredRefreshTokens()

	tokens, err := issueTokens(user)
	if err != nil {
		return util.InternalError(c, "failed to generate tokens")
	}
	return util.Success(c, tokens)
}

func Refresh(c echo.Context) error {
	var req RefreshRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.RefreshToken == "" {
		return util.BadRequest(c, "refresh_token is required")
	}

	hash := model.HashToken(req.RefreshToken)
	rt, err := model.GetRefreshTokenByHash(hash)
	if err != nil {
		return util.Unauthorized(c, "invalid or expired refresh token")
	}

	user, err := model.GetUserByID(rt.UserID)
	if err != nil {
		return util.Unauthorized(c, "user not found")
	}

	// Rotate: delete old, issue new
	model.DeleteRefreshTokensByUserID(user.ID)

	tokens, err := issueTokens(user)
	if err != nil {
		return util.InternalError(c, "failed to generate tokens")
	}
	return util.Success(c, tokens)
}

func GetProfile(c echo.Context) error {
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}
	user, err := model.GetUserByID(claims.UserID)
	if err != nil {
		return util.NotFound(c, "user not found")
	}
	return util.Success(c, user)
}

func UpdateProfile(c echo.Context) error {
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}
	user, err := model.GetUserByID(claims.UserID)
	if err != nil {
		return util.NotFound(c, "user not found")
	}

	var req UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Avatar != "" {
		user.Avatar = req.Avatar
	}
	if err := model.UpdateUser(user); err != nil {
		return util.InternalError(c, "failed to update profile")
	}
	return util.Success(c, user)
}

func ChangePassword(c echo.Context) error {
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}
	user, err := model.GetUserByID(claims.UserID)
	if err != nil {
		return util.NotFound(c, "user not found")
	}

	var req ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.OldPassword == "" || req.NewPassword == "" {
		return util.BadRequest(c, "old_password and new_password are required")
	}
	if len(req.NewPassword) < 8 {
		return util.BadRequest(c, "new password must be at least 8 characters")
	}
	if !user.CheckPassword(req.OldPassword) {
		return util.BadRequest(c, "incorrect old password")
	}
	if err := user.SetPassword(req.NewPassword); err != nil {
		return util.InternalError(c, "failed to process password")
	}
	if err := model.UpdateUser(user); err != nil {
		return util.InternalError(c, "failed to update password")
	}

	// Invalidate all refresh tokens
	model.DeleteRefreshTokensByUserID(user.ID)

	return util.Success(c, map[string]string{"message": "password changed"})
}

// --- OAuth ---

func getOAuthConfig(provider string) (*oauth2.Config, error) {
	clientID := viper.GetString(fmt.Sprintf("auth.oauth.%s.client_id", provider))
	clientSecret := viper.GetString(fmt.Sprintf("auth.oauth.%s.client_secret", provider))
	callbackURL := viper.GetString(fmt.Sprintf("auth.oauth.%s.callback_url", provider))

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("oauth provider %s not configured", provider)
	}

	var endpoint oauth2.Endpoint
	var scopes []string
	switch provider {
	case "github":
		endpoint = github.Endpoint
		scopes = []string{"user:email"}
	case "google":
		endpoint = google.Endpoint
		scopes = []string{"openid", "email", "profile"}
	default:
		return nil, fmt.Errorf("unsupported oauth provider: %s", provider)
	}

	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  callbackURL,
		Scopes:       scopes,
		Endpoint:     endpoint,
	}, nil
}

func OAuthRedirect(c echo.Context) error {
	provider := c.Param("provider")
	cfg, err := getOAuthConfig(provider)
	if err != nil {
		return util.BadRequest(c, err.Error())
	}
	url := cfg.AuthCodeURL("state")
	return c.Redirect(http.StatusTemporaryRedirect, url)
}

func OAuthCallback(c echo.Context) error {
	provider := c.Param("provider")
	cfg, err := getOAuthConfig(provider)
	if err != nil {
		return util.BadRequest(c, err.Error())
	}

	code := c.QueryParam("code")
	if code == "" {
		return util.BadRequest(c, "missing code parameter")
	}

	token, err := cfg.Exchange(c.Request().Context(), code)
	if err != nil {
		return util.InternalError(c, "failed to exchange oauth code")
	}

	// Fetch user info from provider
	oauthID, email, name, avatar, fetchErr := fetchOAuthUserInfo(c, provider, token)
	if fetchErr != nil {
		return util.InternalError(c, "failed to fetch user info from provider")
	}

	// Find or create user
	user, err := model.GetUserByOAuth(provider, oauthID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Check if email is already registered (link accounts)
			user, err = model.GetUserByEmail(email)
			if err != nil {
				// New user
				user = &model.User{
					Email:         email,
					Name:          name,
					Avatar:        avatar,
					OAuthProvider: provider,
					OAuthID:       oauthID,
				}
				if err := model.CreateUser(user); err != nil {
					return util.InternalError(c, "failed to create user")
				}
			} else {
				// Existing user, link OAuth
				user.OAuthProvider = provider
				user.OAuthID = oauthID
				if user.Avatar == "" && avatar != "" {
					user.Avatar = avatar
				}
				if err := model.UpdateUser(user); err != nil {
					return util.InternalError(c, "failed to link oauth account")
				}
			}
		} else {
			return util.InternalError(c, "failed to check user")
		}
	}

	tokens, err := issueTokens(user)
	if err != nil {
		return util.InternalError(c, "failed to generate tokens")
	}

	// Redirect to frontend with tokens (frontend URL from config)
	frontendURL := viper.GetString("auth.frontend_url")
	if frontendURL == "" {
		// Return JSON if no frontend URL configured
		return util.Success(c, tokens)
	}
	accessToken := tokens["access_token"].(string)
	refreshToken := tokens["refresh_token"].(string)
	return c.Redirect(http.StatusTemporaryRedirect,
		fmt.Sprintf("%s/auth/callback?access_token=%s&refresh_token=%s", frontendURL, accessToken, refreshToken))
}

// fetchOAuthUserInfo calls the provider's user API and returns (id, email, name, avatar, error).
func fetchOAuthUserInfo(c echo.Context, provider string, token *oauth2.Token) (string, string, string, string, error) {
	client := oauth2.NewClient(c.Request().Context(), oauth2.StaticTokenSource(token))

	switch provider {
	case "github":
		return fetchGitHubUser(client)
	case "google":
		return fetchGoogleUser(client)
	default:
		return "", "", "", "", fmt.Errorf("unsupported provider: %s", provider)
	}
}

func fetchGitHubUser(client *http.Client) (string, string, string, string, error) {
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return "", "", "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return "", "", "", "", err
	}

	id := ""
	if v, ok := data["id"].(float64); ok {
		id = strconv.FormatInt(int64(v), 10)
	}
	email, _ := data["email"].(string)
	name, _ := data["name"].(string)
	avatar, _ := data["avatar_url"].(string)

	// If email is private, fetch from /user/emails
	if email == "" {
		resp2, err := client.Get("https://api.github.com/user/emails")
		if err == nil {
			defer resp2.Body.Close()
			body2, _ := io.ReadAll(resp2.Body)
			var emails []map[string]interface{}
			if json.Unmarshal(body2, &emails) == nil {
				for _, e := range emails {
					if primary, ok := e["primary"].(bool); ok && primary {
						email, _ = e["email"].(string)
						break
					}
				}
			}
		}
	}

	if name == "" {
		name, _ = data["login"].(string)
	}

	return id, email, name, avatar, nil
}

func fetchGoogleUser(client *http.Client) (string, string, string, string, error) {
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return "", "", "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return "", "", "", "", err
	}

	id, _ := data["id"].(string)
	email, _ := data["email"].(string)
	name, _ := data["name"].(string)
	avatar, _ := data["picture"].(string)

	return id, email, name, avatar, nil
}
