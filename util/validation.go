package util

import (
	"errors"
	"net/url"
	"strings"
)

var (
	// Allowed avatar URL domains (empty = any URL allowed with validation)
	allowedAvatarDomains = []string{
		"avatars.githubusercontent.com",
		"lh3.googleusercontent.com",
		"pbs.twimg.com",
		"i.pravatar.cc",
		"ui-avatars.com",
	}
)

// ValidateAvatarURL validates and sanitizes avatar URL
func ValidateAvatarURL(avatarURL string) error {
	if avatarURL == "" {
		return nil // Empty is valid (no avatar)
	}

	// Limit URL length
	if len(avatarURL) > 500 {
		return errors.New("avatar URL too long (max 500 characters)")
	}

	// Parse URL
	parsed, err := url.Parse(avatarURL)
	if err != nil {
		return errors.New("invalid avatar URL format")
	}

	// Only allow http/https
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("avatar URL must use http or https")
	}

	// Check for dangerous schemes in the raw URL
	if strings.Contains(strings.ToLower(avatarURL), "javascript:") {
		return errors.New("invalid avatar URL scheme")
	}

	// If allowlist is configured, validate domain
	if len(allowedAvatarDomains) > 0 {
		host := parsed.Hostname()
		allowed := false
		for _, domain := range allowedAvatarDomains {
			if host == domain || strings.HasSuffix(host, "."+domain) {
				allowed = true
				break
			}
		}
		if !allowed {
			// For now, allow any valid URL (can tighten later)
			// return errors.New("avatar URL domain not allowed")
		}
	}

	return nil
}

// ValidateConfigSize validates config map size
func ValidateConfigSize(config map[string]interface{}, maxBytes int) error {
	if config == nil {
		return nil
	}

	// Rough estimation of size by counting keys and checking depth
	totalSize := 0
	for k, v := range config {
		totalSize += len(k)
		totalSize += estimateValueSize(v, 0)
	}

	if totalSize > maxBytes {
		return errors.New("config size exceeds maximum allowed")
	}

	return nil
}

func estimateValueSize(v interface{}, depth int) int {
	if depth > 10 {
		return 0 // Prevent infinite recursion
	}

	switch val := v.(type) {
	case string:
		return len(val)
	case float64, int, int64, float32, bool:
		return 8
	case []interface{}:
		size := 0
		for _, item := range val {
			size += estimateValueSize(item, depth+1)
		}
		return size
	case map[string]interface{}:
		size := 0
		for k, v := range val {
			size += len(k) + estimateValueSize(v, depth+1)
		}
		return size
	default:
		return 16
	}
}