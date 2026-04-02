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
