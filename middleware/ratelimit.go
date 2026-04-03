package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

// RateLimiter tracks request counts per IP
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string]*ipRecord
	limit    int           // max requests per window
	window   time.Duration // time window
}

type ipRecord struct {
	count     int
	firstSeen time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*ipRecord),
		limit:    limit,
		window:   window,
	}
	// Start cleanup goroutine
	go rl.cleanup()
	return rl
}

// cleanup removes old entries periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, record := range rl.requests {
			if now.Sub(record.firstSeen) > rl.window {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if the IP is allowed to make a request
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	record, exists := rl.requests[ip]

	if !exists || now.Sub(record.firstSeen) > rl.window {
		rl.requests[ip] = &ipRecord{count: 1, firstSeen: now}
		return true
	}

	if record.count >= rl.limit {
		return false
	}

	record.count++
	return true
}

// RateLimit returns middleware that limits requests per IP
func RateLimit(limit int, window time.Duration) echo.MiddlewareFunc {
	limiter := NewRateLimiter(limit, window)
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			if !limiter.Allow(ip) {
				return c.JSON(http.StatusTooManyRequests, map[string]interface{}{
					"code":    429,
					"message": "too many requests, please try again later",
				})
			}
			return next(c)
		}
	}
}