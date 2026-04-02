# ClawHost Backend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the App tenant layer, add User model with JWT authentication (email/password + OAuth), and rename Bot to Agent across the entire ClawHost Go backend.

**Architecture:** ClawHost is a Go API server (Echo v4 + GORM + client-go). The refactor replaces the App→Bot multi-tenant model with User→Agent, swaps bearer-token auth for JWT, and adds registration/login/OAuth endpoints. The K8s orchestration layer and proxy are unchanged in logic, only updated in naming.

**Tech Stack:** Go 1.24, Echo v4, GORM/PostgreSQL, golang-jwt/jwt/v5 (new dep), golang.org/x/crypto/bcrypt (new dep), golang.org/x/oauth2 (new dep)

**Spec:** `docs/superpowers/specs/2026-04-01-user-portal-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `model/user.go` | User struct, RefreshToken struct, GORM operations, password hashing |
| `middleware/jwt.go` | JWT generation, validation middleware, token refresh helpers |
| `handler/api/v1/auth.go` | Register, login, refresh, OAuth redirect/callback, profile endpoints |
| `handler/api/v1/admin_user.go` | Admin user management (list, update) |
| `handler/api/v1/admin_stats.go` | System stats endpoint |
| `cmd/admin.go` | `clawhost admin promote <email>` CLI command |

### Renamed files (bot → agent)

| Current | New |
|---------|-----|
| `model/bot.go` | `model/agent.go` |
| `handler/api/v1/bot_create.go` | `handler/api/v1/agent_create.go` |
| `handler/api/v1/bot_list.go` | `handler/api/v1/agent_list.go` |
| `handler/api/v1/bot_get.go` | `handler/api/v1/agent_get.go` |
| `handler/api/v1/bot_update.go` | `handler/api/v1/agent_update.go` |
| `handler/api/v1/bot_delete.go` | `handler/api/v1/agent_delete.go` |
| `handler/api/v1/bot_start.go` | `handler/api/v1/agent_start.go` |
| `handler/api/v1/bot_stop.go` | `handler/api/v1/agent_stop.go` |
| `handler/api/v1/bot_restart.go` | `handler/api/v1/agent_restart.go` |
| `handler/api/v1/bot_restart_all.go` | `handler/api/v1/agent_restart_all.go` |
| `handler/api/v1/bot_status.go` | `handler/api/v1/agent_status.go` |
| `handler/api/v1/bot_connect.go` | `handler/api/v1/agent_connect.go` |
| `handler/api/v1/bot_reset_token.go` | `handler/api/v1/agent_reset_token.go` |
| `handler/api/v1/bot_upgrade.go` | `handler/api/v1/agent_upgrade.go` |
| `handler/api/v1/bot_channel.go` | `handler/api/v1/agent_channel.go` |
| `handler/api/v1/bot_channel_wechat.go` | `handler/api/v1/agent_channel_wechat.go` |
| `handler/api/v1/bot_config_defaults.go` | `handler/api/v1/agent_config_defaults.go` |
| `handler/api/v1/bot_config_models.go` | `handler/api/v1/agent_config_models.go` |
| `handler/api/v1/bot_config_raw.go` | `handler/api/v1/agent_config_raw.go` |
| `handler/api/v1/bot_devices.go` | `handler/api/v1/agent_devices.go` |
| `handler/api/v1/skill_list.go` | `handler/api/v1/agent_skill_list.go` |
| `handler/api/v1/skill_update.go` | `handler/api/v1/agent_skill_update.go` |
| `handler/api/v1/skill_delete.go` | `handler/api/v1/agent_skill_delete.go` |

### Modified files (logic changes)

| File | Change |
|------|--------|
| `cmd/server.go` | New route groups, rename paths, swap middleware |
| `cmd/root.go` | Add admin subcommand |
| `middleware/auth.go` | Rewrite: JWTAuth, AgentOwnerAuth, AdminAuth (role-based) |
| `handler/proxy/proxy.go` | `model.Bot` → `model.Agent` references |
| `handler/api/v1/config_utils.go` | `Bot` → `Agent` references |
| `service/k8s/deployment.go` | Rename BotConfig to AgentConfig in package |
| `service/k8s/botconfig.go` → `service/k8s/agentconfig.go` | Rename file and functions |
| `service/k8s/config_sync.go` | `model.Bot` → `model.Agent` |
| `service/k8s/channel.go` | `model.Bot` → `model.Agent` |
| `service/k8s/gateway.go` | No model references, unchanged |
| `service/k8s/workspace.go` | No model references, unchanged |
| `service/k8s/service.go` | No model references, unchanged |
| `service/k8s/approve.go` | No model references, unchanged |
| `util/config.go` | No changes needed (Viper handles new sections automatically) |
| `config.example.toml` | Add [auth] section, remove [api].admin_token |
| `model/openclaw_config.go` | No changes (operates on config JSON, no Bot/App references) |

### Deleted files

| File | Reason |
|------|--------|
| `model/app.go` | App model removed |
| `handler/api/v1/app.go` | App CRUD handlers removed |

---

## Task 1: Add new Go dependencies

**Files:**
- Modify: `go.mod`

- [ ] **Step 1: Add JWT, bcrypt, and OAuth2 dependencies**

```bash
cd /Users/rain/code/west-garden/clawhost
go get github.com/golang-jwt/jwt/v5@latest
go get golang.org/x/crypto@latest
go get golang.org/x/oauth2@latest
```

- [ ] **Step 2: Verify dependencies resolve**

```bash
go mod tidy
```

Expected: Clean exit, no errors.

- [ ] **Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "deps: add golang-jwt, crypto/bcrypt, oauth2"
```

---

## Task 2: Create User model

**Files:**
- Create: `model/user.go`

- [ ] **Step 1: Create the User and RefreshToken models with all DB operations**

```go
// model/user.go
package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/clawhost/clawhost/util"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID            string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Email         string    `json:"email" gorm:"type:varchar(255);uniqueIndex;not null"`
	PasswordHash  string    `json:"-" gorm:"type:varchar(255)"`
	Name          string    `json:"name" gorm:"type:varchar(255)"`
	Avatar        string    `json:"avatar,omitempty" gorm:"type:varchar(500)"`
	OAuthProvider string    `json:"oauth_provider,omitempty" gorm:"type:varchar(50)"`
	OAuthID       string    `json:"oauth_id,omitempty" gorm:"type:varchar(255)"`
	Role          string    `json:"role" gorm:"type:varchar(20);default:'user'"`
	Status        string    `json:"status" gorm:"type:varchar(20);default:'active'"`
	APIToken      string    `json:"api_token,omitempty" gorm:"type:varchar(64)"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	if u.Role == "" {
		u.Role = "user"
	}
	if u.Status == "" {
		u.Status = "active"
	}
	return nil
}

// SetPassword hashes the password with bcrypt and stores it.
func (u *User) SetPassword(password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	u.PasswordHash = string(hash)
	return nil
}

// CheckPassword verifies a password against the stored hash.
func (u *User) CheckPassword(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) == nil
}

type RefreshToken struct {
	ID        string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID    string    `json:"user_id" gorm:"type:varchar(36);index;not null"`
	TokenHash string    `json:"-" gorm:"type:varchar(255);not null"`
	ExpiresAt time.Time `json:"expires_at" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}

func (r *RefreshToken) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

// HashToken returns the SHA-256 hex digest of a raw token string.
func HashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// GenerateRandomToken returns a cryptographically random hex string of the given byte length.
func GenerateRandomToken(byteLen int) string {
	b := make([]byte, byteLen)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// --- User DB operations ---

func CreateUser(user *User) error {
	return util.GetDB().Create(user).Error
}

func GetUserByID(id string) (*User, error) {
	var user User
	if err := util.GetDB().Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByEmail(email string) (*User, error) {
	var user User
	if err := util.GetDB().Where("email = ? AND status = ?", email, "active").First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByOAuth(provider, oauthID string) (*User, error) {
	var user User
	if err := util.GetDB().Where("oauth_provider = ? AND oauth_id = ?", provider, oauthID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func ListUsers() ([]*User, error) {
	var users []*User
	if err := util.GetDB().Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func UpdateUser(user *User) error {
	return util.GetDB().Save(user).Error
}

func CountUsers() (int64, error) {
	var count int64
	if err := util.GetDB().Model(&User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func PromoteUserToAdmin(email string) error {
	result := util.GetDB().Model(&User{}).Where("email = ?", email).Update("role", "admin")
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("user with email %s not found", email)
	}
	return nil
}

// --- RefreshToken DB operations ---

func CreateRefreshToken(rt *RefreshToken) error {
	return util.GetDB().Create(rt).Error
}

func GetRefreshTokenByHash(hash string) (*RefreshToken, error) {
	var rt RefreshToken
	if err := util.GetDB().Where("token_hash = ? AND expires_at > ?", hash, time.Now()).First(&rt).Error; err != nil {
		return nil, err
	}
	return &rt, nil
}

func DeleteRefreshTokensByUserID(userID string) error {
	return util.GetDB().Where("user_id = ?", userID).Delete(&RefreshToken{}).Error
}

func DeleteExpiredRefreshTokens() error {
	return util.GetDB().Where("expires_at < ?", time.Now()).Delete(&RefreshToken{}).Error
}

func AutoMigrateUser() error {
	db := util.GetDB()
	if err := db.AutoMigrate(&User{}); err != nil {
		return err
	}
	return db.AutoMigrate(&RefreshToken{})
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./model/...
```

Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add model/user.go
git commit -m "feat: add User and RefreshToken models"
```

---

## Task 3: Create JWT middleware

**Files:**
- Create: `middleware/jwt.go`

- [ ] **Step 1: Create JWT generation and validation middleware**

```go
// middleware/jwt.go
package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
)

const ContextKeyUser = "authenticated_user"

// UserClaims holds the JWT payload.
type UserClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateAccessToken creates a short-lived JWT.
func GenerateAccessToken(userID, email, role string) (string, error) {
	secret := viper.GetString("auth.jwt_secret")
	ttl := viper.GetDuration("auth.jwt_access_ttl")
	if ttl == 0 {
		ttl = 15 * time.Minute
	}

	claims := UserClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken validates and parses a JWT string.
func ParseToken(tokenStr string) (*UserClaims, error) {
	secret := viper.GetString("auth.jwt_secret")

	token, err := jwt.ParseWithClaims(tokenStr, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

// JWTAuth returns middleware that validates JWT from the Authorization header.
func JWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"code": 401, "message": "missing authorization header",
				})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"code": 401, "message": "invalid authorization format, expected: Bearer <token>",
				})
			}

			claims, err := ParseToken(parts[1])
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"code": 401, "message": "invalid or expired token",
				})
			}

			c.Set(ContextKeyUser, claims)
			return next(c)
		}
	}
}

// GetUserClaimsFromContext retrieves the authenticated user claims from context.
func GetUserClaimsFromContext(c echo.Context) *UserClaims {
	claims, ok := c.Get(ContextKeyUser).(*UserClaims)
	if !ok {
		return nil
	}
	return claims
}

// AdminAuth returns middleware that checks the JWT user has role "admin".
// Must be used after JWTAuth.
func AdminAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := GetUserClaimsFromContext(c)
			if claims == nil || claims.Role != "admin" {
				return c.JSON(http.StatusForbidden, map[string]interface{}{
					"code": 403, "message": "admin access required",
				})
			}
			return next(c)
		}
	}
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./middleware/...
```

Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add middleware/jwt.go
git commit -m "feat: add JWT auth middleware and token generation"
```

---

## Task 4: Create auth handler

**Files:**
- Create: `handler/api/v1/auth.go`

- [ ] **Step 1: Create auth handler with register, login, refresh, profile, OAuth endpoints**

```go
// handler/api/v1/auth.go
package v1

import (
	"fmt"
	"net/http"
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
```

- [ ] **Step 2: Create OAuth provider helper functions in the same file (append)**

```go
// Append to handler/api/v1/auth.go

import (
	"encoding/json"
	"io"
	"strconv"
)

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
```

Note: The actual file should have a single unified import block. The two code blocks above are logically separate for readability, but must be written as one file with all imports merged.

- [ ] **Step 3: Verify it compiles**

```bash
go build ./handler/api/v1/...
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add handler/api/v1/auth.go
git commit -m "feat: add auth handler (register, login, refresh, OAuth, profile)"
```

---

## Task 5: Rename Bot → Agent in model layer

This task renames the model file and all references. It's a large mechanical change.

**Files:**
- Delete: `model/app.go`
- Rename: `model/bot.go` → `model/agent.go`
- Modify: `model/agent.go` (rename struct, remove AppID, update functions)
- Modify: `model/openclaw_config.go` (Bot method receivers → Agent)

- [ ] **Step 1: Delete app.go**

```bash
cd /Users/rain/code/west-garden/clawhost
git rm model/app.go
```

- [ ] **Step 2: Rename bot.go to agent.go via git**

```bash
git mv model/bot.go model/agent.go
```

- [ ] **Step 3: Update model/agent.go**

Make these changes to `model/agent.go`:

1. Rename `Bot` struct to `Agent`, `BotStatus` to `AgentStatus`, constants `BotStatusCreated` → `AgentStatusCreated`, etc.
2. Remove `AppID` field from Agent struct
3. Change `TableName()` to return `"agents"`
4. Rename all functions: `CreateBot` → `CreateAgent`, `GetBotByID` → `GetAgentByID`, etc.
5. Remove `ListBotsByAppAndUser` — replace with `ListAgentsByUserID` (no app filter)
6. Update `AutoMigrate` to call `AutoMigrateUser()` instead of `AutoMigrateApp()`
7. Remove `migrateExistingBots` or update to `migrateExistingAgents`

Key renames (every occurrence in the file):
- `Bot` → `Agent` (struct name, function names, variable names)
- `BotStatus` → `AgentStatus`
- `BotConfig` → keep as `AgentConfig` in model (or keep `BotConfig` name — see note)
- `bot` → `agent` (variable names)
- `"bots"` → `"agents"` (table name)
- Remove all references to `AppID` and `app_id`

Note: The `BotConfig` struct in `model/bot.go` is a legacy config representation. Rename it to `AgentConfig` for consistency.

- [ ] **Step 4: Update model/openclaw_config.go method receivers**

Change `(b *Bot)` to `(a *Agent)` on methods: `GetOpenClawConfig`, `SetOpenClawConfig`, `MergeOpenClawConfig`.

- [ ] **Step 5: Verify it compiles (model package only, other packages will break)**

```bash
go build ./model/...
```

Expected: Clean build for model package.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename Bot to Agent, remove App model"
```

---

## Task 6: Update middleware — replace BearerAuth/BotOwnerAuth

**Files:**
- Modify: `middleware/auth.go`

- [ ] **Step 1: Rewrite auth.go**

Replace the entire content of `middleware/auth.go` with:

```go
package middleware

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

const (
	ContextKeyAgent = "authorized_agent"
)

// AgentOwnerAuth validates that the JWT-authenticated user owns the agent
// identified by the ":id" path parameter.
// Must be used after JWTAuth middleware.
func AgentOwnerAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			agentID := c.Param("id")
			if agentID == "" {
				return util.BadRequest(c, "agent id is required")
			}

			agent, err := model.GetAgentByID(agentID)
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return util.NotFound(c, "agent not found")
				}
				return util.InternalError(c, "failed to get agent")
			}

			// Verify ownership via JWT claims
			claims := GetUserClaimsFromContext(c)
			if claims != nil {
				if agent.UserID != claims.UserID {
					return util.Forbidden(c, "not authorized to access this agent")
				}
			}

			c.Set(ContextKeyAgent, agent)
			return next(c)
		}
	}
}

// GetAgentFromContext retrieves the authorized agent from the request context.
func GetAgentFromContext(c echo.Context) *model.Agent {
	agent, ok := c.Get(ContextKeyAgent).(*model.Agent)
	if !ok {
		return nil
	}
	return agent
}
```

This removes `BearerAuth`, `BotOwnerAuth`, `GetAppFromContext`, `GetBotFromContext`, `ContextKeyApp`, `ContextKeyBot`. The `JWTAuth` and `AdminAuth` middlewares are already in `jwt.go`.

- [ ] **Step 2: Verify it compiles**

```bash
go build ./middleware/...
```

Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add middleware/auth.go
git commit -m "refactor: replace BearerAuth/BotOwnerAuth with AgentOwnerAuth"
```

---

## Task 7: Rename handler files bot_* → agent_* and update references

This is the largest mechanical task. Every `handler/api/v1/bot_*.go` file needs renaming and its contents need `Bot` → `Agent` and `bot` → `agent` replacements.

**Files:**
- Delete: `handler/api/v1/app.go`
- Rename: all 19 `bot_*.go` files to `agent_*.go`
- Rename: `skill_*.go` files to `agent_skill_*.go`
- Modify: all renamed files (struct/function renames)
- Modify: `handler/api/v1/config_utils.go`

- [ ] **Step 1: Delete app handler**

```bash
git rm handler/api/v1/app.go
```

- [ ] **Step 2: Rename all bot handler files**

```bash
cd /Users/rain/code/west-garden/clawhost/handler/api/v1
for f in bot_*.go; do git mv "$f" "agent_${f#bot_}"; done
git mv skill_list.go agent_skill_list.go
git mv skill_update.go agent_skill_update.go
git mv skill_delete.go agent_skill_delete.go
```

- [ ] **Step 3: Search-and-replace in all agent_*.go files and config_utils.go**

In every renamed file, perform these replacements:

| Find | Replace |
|------|---------|
| `GetBotFromContext` | `GetAgentFromContext` (from middleware package) |
| `middleware.GetBotFromContext` | `middleware.GetAgentFromContext` |
| `middleware.GetAppFromContext` | Delete these lines — no more App in context |
| `model.Bot` | `model.Agent` |
| `model.BotStatus` | `model.AgentStatus` |
| `model.BotStatusCreated` | `model.AgentStatusCreated` |
| `model.BotStatusRunning` | `model.AgentStatusRunning` |
| `model.BotStatusStopped` | `model.AgentStatusStopped` |
| `model.BotStatusError` | `model.AgentStatusError` |
| `model.CreateBot` | `model.CreateAgent` |
| `model.GetBotByID` | `model.GetAgentByID` |
| `model.UpdateBot` | `model.UpdateAgent` |
| `model.DeleteBot` | `model.DeleteAgent` |
| `model.UpdateBotStatus` | `model.UpdateAgentStatus` |
| `model.ResetBotAccessToken` | `model.ResetAgentAccessToken` |
| `model.ListBotsByAppAndUser` | `model.ListAgentsByUserID` |
| `model.ListBotsByStatus` | `model.ListAgentsByStatus` |
| `*model.BotConfig` | `*model.AgentConfig` (if renamed in Task 5) |
| `CreateBot` (function name) | `CreateAgent` |
| `ListBots` | `ListAgents` |
| `GetBot` | `GetAgent` |
| `UpdateBot` (handler func) | `UpdateAgent` |
| `DeleteBot` (handler func) | `DeleteAgent` |
| `StartBot` | `StartAgent` |
| `StopBot` | `StopAgent` |
| `RestartBot` | `RestartAgent` |
| `GetBotStatus` | `GetAgentStatus` |
| `GetBotConnect` | `GetAgentConnect` |
| `ResetBotToken` | `ResetAgentToken` |
| `UpgradeBot` | `UpgradeAgent` |
| `UpgradeAllBots` | `UpgradeAllAgents` |
| `RestartAllBots` | `RestartAllAgents` |

In `agent_create.go` specifically: remove `AppID` assignment from `CreateBotRequest`/`CreateAgentRequest`. Instead, get `UserID` from JWT claims:

```go
claims := middleware.GetUserClaimsFromContext(c)
agent.UserID = claims.UserID
```

In `agent_list.go`: remove `app_id` logic, use JWT claims for user_id:

```go
claims := middleware.GetUserClaimsFromContext(c)
agents, err := model.ListAgentsByUserID(claims.UserID)
```

- [ ] **Step 4: Update config_utils.go**

Replace `Bot` → `Agent` references: function parameter types, variable names.

- [ ] **Step 5: Verify it compiles**

```bash
go build ./handler/api/v1/...
```

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename bot handlers to agent, remove app handler"
```

---

## Task 8: Update service/k8s layer

**Files:**
- Rename: `service/k8s/botconfig.go` → `service/k8s/agentconfig.go`
- Modify: `service/k8s/deployment.go` (rename BotConfig struct)
- Modify: `service/k8s/config_sync.go` (model.Bot → model.Agent)
- Modify: `service/k8s/channel.go` (model.Bot → model.Agent)

- [ ] **Step 1: Rename botconfig.go**

```bash
git mv service/k8s/botconfig.go service/k8s/agentconfig.go
```

- [ ] **Step 2: Update deployment.go**

Rename `k8s.BotConfig` struct to `k8s.AgentConfig`. Update all function signatures that take `*BotConfig` to take `*AgentConfig`. Update `ModelProviderConfig`, `AgentDefaultsConfig` — these names are fine, keep them. Rename variables: `config *BotConfig` → `config *AgentConfig`.

- [ ] **Step 3: Update agentconfig.go (formerly botconfig.go)**

Rename function names: `WriteConfigToBot` → `WriteConfigToAgent`, `ReadBotConfig` → `ReadAgentConfig`, `WriteBotConfig` → `WriteAgentConfig`, `buildOpenClawConfig` stays (it builds openclaw config, not bot-specific). Update all `*BotConfig` parameter types to `*AgentConfig`.

- [ ] **Step 4: Update config_sync.go**

Replace `model.Bot` → `model.Agent`, `model.GetBotByID` → `model.GetAgentByID`, `model.UpdateBot` → `model.UpdateAgent`, `model.BotStatusRunning` → `model.AgentStatusRunning`, `bot` → `agent` variable names.

- [ ] **Step 5: Update channel.go**

Same replacements as config_sync.go for any `model.Bot` references.

- [ ] **Step 6: Verify it compiles**

```bash
go build ./service/k8s/...
```

Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename BotConfig to AgentConfig in k8s service layer"
```

---

## Task 9: Update proxy handler

**Files:**
- Modify: `handler/proxy/proxy.go`

- [ ] **Step 1: Update model references**

Replace in `proxy.go`:
- `model.Bot` → `model.Agent`
- `model.GetBotByID` → `model.GetAgentByID`
- `model.GetBotBySlug` → `model.GetAgentBySlug`
- `model.BotStatusRunning` → `model.AgentStatusRunning`
- `*model.Bot` → `*model.Agent` (in function signatures and variables)
- `bot` → `agent` (variable names)
- `bot.ID` → `agent.ID`, `bot.AccessToken` → `agent.AccessToken`, etc.
- `botID` → `agentID` in variable names

Keep the proxy URL path as `/proxy/:bot_id` for now (or rename to `/proxy/:agent_id` — this is a URL-level change that affects the subdomain rewrite middleware too).

- [ ] **Step 2: Update cmd/server.go proxy route parameter**

If renaming the URL param, also update `cmd/server.go`:
```go
e.Any("/proxy/:agent_id", proxy.ProxyToAgent)
e.Any("/proxy/:agent_id/*", proxy.ProxyToAgent)
```
And the subdomain rewrite middleware to use `"/proxy/" + agentID + path`.

Rename `ProxyToBot` → `ProxyToAgent`.

- [ ] **Step 3: Verify it compiles**

```bash
go build ./handler/proxy/...
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename Bot to Agent in proxy handler"
```

---

## Task 10: Update cmd/server.go routing

**Files:**
- Modify: `cmd/server.go`

- [ ] **Step 1: Rewrite the route setup**

Key changes:
1. Replace `/bot/api/v1` prefix with `/api/v1`
2. Replace `authmw.BearerAuth()` with `authmw.JWTAuth()`
3. Replace `authmw.BotOwnerAuth()` with `authmw.AgentOwnerAuth()`
4. Replace old `AdminAuth()` with `authmw.JWTAuth()` + `authmw.AdminAuth()` (JWT first, then role check)
5. Add `/auth/*` route group (no auth middleware)
6. Rename all handler function references: `v1.CreateBot` → `v1.CreateAgent`, etc.
7. Rename route paths: `/bots` → `/agents`
8. Remove admin app routes (`admin.POST("/apps", ...)` etc.)
9. Add admin user/stats routes

The full routing structure becomes:

```go
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

// Agent collection routes
api := e.Group("/api/v1")
api.Use(authmw.JWTAuth())
api.POST("/agents", v1.CreateAgent)
api.GET("/agents", v1.ListAgents)

// Agent instance routes
agentAPI := api.Group("/agents/:id")
agentAPI.Use(authmw.AgentOwnerAuth())
// ... all existing sub-routes with renamed handlers

// Admin routes
admin := e.Group("/api/v1/admin")
admin.Use(authmw.JWTAuth())
admin.Use(authmw.AdminAuth())
admin.GET("/users", v1.ListUsersAdmin)
admin.PUT("/users/:id", v1.UpdateUserAdmin)
admin.GET("/agents", v1.ListAllAgentsAdmin)
admin.POST("/agents/upgrade", v1.UpgradeAllAgents)
admin.POST("/agents/:id/upgrade", v1.UpgradeAgent)
admin.POST("/agents/restart", v1.RestartAllAgents)
admin.GET("/stats", v1.GetStats)
```

- [ ] **Step 2: Update subdomain rewrite middleware**

In the `e.Pre` middleware, rename `botID` → `agentID` and update the rewrite path to use the new proxy param name.

- [ ] **Step 3: Verify it compiles**

```bash
go build .
```

Expected: Clean build of the entire binary.

- [ ] **Step 4: Commit**

```bash
git add cmd/server.go
git commit -m "refactor: update routing - /api/v1/agents, JWT auth, admin role-based"
```

---

## Task 11: Create admin handlers

**Files:**
- Create: `handler/api/v1/admin_user.go`
- Create: `handler/api/v1/admin_stats.go`

- [ ] **Step 1: Create admin_user.go**

```go
// handler/api/v1/admin_user.go
package v1

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func ListUsersAdmin(c echo.Context) error {
	users, err := model.ListUsers()
	if err != nil {
		return util.InternalError(c, "failed to list users")
	}
	return util.Success(c, users)
}

type UpdateUserAdminRequest struct {
	Role   string `json:"role,omitempty"`
	Status string `json:"status,omitempty"`
}

func UpdateUserAdmin(c echo.Context) error {
	id := c.Param("id")
	user, err := model.GetUserByID(id)
	if err != nil {
		return util.NotFound(c, "user not found")
	}

	var req UpdateUserAdminRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Role != "" {
		if req.Role != "user" && req.Role != "admin" {
			return util.BadRequest(c, "role must be 'user' or 'admin'")
		}
		user.Role = req.Role
	}
	if req.Status != "" {
		if req.Status != "active" && req.Status != "disabled" {
			return util.BadRequest(c, "status must be 'active' or 'disabled'")
		}
		user.Status = req.Status
	}

	if err := model.UpdateUser(user); err != nil {
		return util.InternalError(c, "failed to update user")
	}
	return util.Success(c, user)
}
```

- [ ] **Step 2: Create admin_stats.go**

```go
// handler/api/v1/admin_stats.go
package v1

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func GetStats(c echo.Context) error {
	userCount, _ := model.CountUsers()
	agentCount, _ := model.CountAgents()
	runningCount, _ := model.CountAgentsByStatus(model.AgentStatusRunning)

	return util.Success(c, map[string]interface{}{
		"users":          userCount,
		"agents":         agentCount,
		"running_agents": runningCount,
	})
}
```

Note: `CountAgents` and `CountAgentsByStatus` need to be added to `model/agent.go`:

```go
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
```

Also add `ListAllAgentsAdmin` (lists across all users) to the existing agent list handler or a new file:

```go
func ListAllAgentsAdmin(c echo.Context) error {
	var agents []*model.Agent
	if err := util.GetDB().Order("created_at DESC").Find(&agents).Error; err != nil {
		return util.InternalError(c, "failed to list agents")
	}
	return util.Success(c, agents)
}
```

- [ ] **Step 3: Verify it compiles**

```bash
go build .
```

- [ ] **Step 4: Commit**

```bash
git add handler/api/v1/admin_user.go handler/api/v1/admin_stats.go model/agent.go
git commit -m "feat: add admin handlers (user management, stats)"
```

---

## Task 12: Add admin CLI command

**Files:**
- Create: `cmd/admin.go`

- [ ] **Step 1: Create admin promote command**

```go
// cmd/admin.go
package cmd

import (
	"fmt"
	"log"

	"github.com/clawhost/clawhost/model"
	"github.com/spf13/cobra"
)

var adminCmd = &cobra.Command{
	Use:   "admin",
	Short: "Admin management commands",
}

var promoteCmd = &cobra.Command{
	Use:   "promote [email]",
	Short: "Promote a user to admin role",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		email := args[0]

		if err := initConfig(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}

		if err := model.PromoteUserToAdmin(email); err != nil {
			log.Fatalf("failed to promote user: %v", err)
		}

		fmt.Printf("User %s promoted to admin\n", email)
	},
}

func init() {
	adminCmd.AddCommand(promoteCmd)
	rootCmd.AddCommand(adminCmd)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build .
./clawhost admin --help
```

Expected: Shows "promote" subcommand.

- [ ] **Step 3: Commit**

```bash
git add cmd/admin.go
git commit -m "feat: add 'clawhost admin promote' CLI command"
```

---

## Task 13: Update config.example.toml

**Files:**
- Modify: `config.example.toml`

- [ ] **Step 1: Add auth section, remove admin_token**

Replace the `[api]` section with `[auth]` section:

```toml
[auth]
jwt_secret = "change-me-to-a-random-string"
jwt_access_ttl = "15m"
jwt_refresh_ttl = "168h"
# frontend_url = "http://localhost:3000"  # Uncomment for OAuth redirect to frontend

# [auth.oauth.github]
# client_id = ""
# client_secret = ""
# callback_url = "http://localhost:18080/auth/oauth/github/callback"

# [auth.oauth.google]
# client_id = ""
# client_secret = ""
# callback_url = "http://localhost:18080/auth/oauth/google/callback"
```

Remove the old `[api]` section entirely.

- [ ] **Step 2: Commit**

```bash
git add config.example.toml
git commit -m "config: replace [api] admin_token with [auth] JWT config"
```

---

## Task 14: Full build and smoke test

**Files:** None (integration verification)

- [ ] **Step 1: Clean build**

```bash
go build -o clawhost .
```

Expected: Builds with zero errors.

- [ ] **Step 2: Update local config.toml**

Add auth section to your local `config.toml`:

```toml
[auth]
jwt_secret = "test-secret-for-local-dev"
jwt_access_ttl = "15m"
jwt_refresh_ttl = "168h"
```

Remove `[api]` section.

- [ ] **Step 3: Start server and test register/login flow**

```bash
./clawhost server &
sleep 3

# Register
curl -s -X POST http://localhost:18080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}' | python3 -m json.tool

# Login
curl -s -X POST http://localhost:18080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | python3 -m json.tool

# Use access_token from login response:
export TOKEN="<access_token_from_response>"

# Get profile
curl -s http://localhost:18080/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Create agent
curl -s -X POST http://localhost:18080/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent","slug":"test"}' | python3 -m json.tool

# List agents
curl -s http://localhost:18080/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: All endpoints return `{"code": 0, "message": "success", ...}`.

- [ ] **Step 4: Test admin promotion**

```bash
./clawhost admin promote test@example.com

# Login again to get new JWT with admin role
curl -s -X POST http://localhost:18080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | python3 -m json.tool

# Use new token for admin endpoints
curl -s http://localhost:18080/api/v1/admin/stats \
  -H "Authorization: Bearer $NEW_TOKEN" | python3 -m json.tool
```

Expected: Stats endpoint returns user/agent counts.

- [ ] **Step 5: Commit any fixes from smoke test**

```bash
git add -A
git commit -m "fix: smoke test fixes for backend refactor"
```

(Only if fixes were needed.)
