package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/clawhost/clawhost/util"
	"github.com/google/uuid"
	"github.com/spf13/viper"
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
	// Security fields for brute-force protection
	FailedLoginAttempts int       `json:"-" gorm:"default:0"`
	LockedUntil         time.Time `json:"-" gorm:"type:timestamp;default:null"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
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

// IsLocked checks if the account is temporarily locked due to failed login attempts.
func (u *User) IsLocked() bool {
	return u.LockedUntil.After(time.Now())
}

// IncrementFailedLogin increments failed attempts and locks account if threshold reached.
// Returns the lock duration if account was locked.
func (u *User) IncrementFailedLogin(maxAttempts int, lockDuration time.Duration) (locked bool, lockUntil time.Time) {
	u.FailedLoginAttempts++
	if u.FailedLoginAttempts >= maxAttempts && !u.IsLocked() {
		u.LockedUntil = time.Now().Add(lockDuration)
		util.GetDB().Save(u)
		return true, u.LockedUntil
	}
	util.GetDB().Save(u)
	return false, time.Time{}
}

// ResetFailedLogin clears failed login attempts on successful login.
func (u *User) ResetFailedLogin() {
	if u.FailedLoginAttempts > 0 || !u.LockedUntil.IsZero() {
		u.FailedLoginAttempts = 0
		u.LockedUntil = time.Time{}
		util.GetDB().Save(u)
	}
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

// CreateInitialAdmin creates the initial admin user from config if not exists.
// Config: [auth.initial_admin] email, password, name
// Security: Only creates if user doesn't exist, requires min 8 char password
func CreateInitialAdmin() error {
	email := viper.GetString("auth.initial_admin.email")
	password := viper.GetString("auth.initial_admin.password")
	name := viper.GetString("auth.initial_admin.name")

	if email == "" || password == "" {
		// No initial admin configured, skip
		return nil
	}

	// Password strength check
	if len(password) < 8 {
		return fmt.Errorf("initial admin password must be at least 8 characters")
	}

	// Check if user already exists - NEVER overwrite existing user
	existing, err := GetUserByEmailUnfiltered(email)
	if err == nil && existing != nil {
		// User exists, skip silently (don't log to avoid info disclosure)
		return nil
	}

	if name == "" {
		name = email
	}

	user := &User{
		Email: email,
		Name:  name,
		Role:  "admin",
	}
	if err := user.SetPassword(password); err != nil {
		return fmt.Errorf("failed to set password: %w", err)
	}
	if err := CreateUser(user); err != nil {
		return fmt.Errorf("failed to create initial admin: %w", err)
	}

	// Log only to stdout, not to external logs
	fmt.Printf("Initial admin user created: %s\n", email)
	return nil
}

// GetUserByEmailUnfiltered gets user by email without status filter (for internal checks)
func GetUserByEmailUnfiltered(email string) (*User, error) {
	var user User
	if err := util.GetDB().Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
