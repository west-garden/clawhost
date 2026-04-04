package marketplace

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	DefaultRegistryURL  = "https://raw.githubusercontent.com/west-garden/clawhost-skills/main"
	DefaultCacheMinutes = 5
)

// SkillListing represents a skill in the marketplace index
type SkillListing struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description"`
	Author      string   `json:"author"`
	Version     string   `json:"version"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	Path        string   `json:"path"`
}

// Index represents the marketplace index.json
type Index struct {
	Version   int             `json:"version"`
	UpdatedAt string          `json:"updated_at"`
	Skills    []SkillListing `json:"skills"`
}

// Fetcher fetches skill data from the registry
type Fetcher struct {
	registryURL  string
	cacheMinutes int
	indexCache   *Index
	cacheTime    time.Time
	cacheMu      sync.RWMutex
	client       *http.Client
}

// NewFetcher creates a new marketplace fetcher
func NewFetcher(registryURL string, cacheMinutes int) *Fetcher {
	if registryURL == "" {
		registryURL = DefaultRegistryURL
	}
	if cacheMinutes <= 0 {
		cacheMinutes = DefaultCacheMinutes
	}
	return &Fetcher{
		registryURL:  registryURL,
		cacheMinutes: cacheMinutes,
		client:       &http.Client{Timeout: 30 * time.Second},
	}
}

// FetchIndex fetches the marketplace index (with caching)
func (f *Fetcher) FetchIndex() (*Index, error) {
	f.cacheMu.RLock()
	if f.indexCache != nil && time.Since(f.cacheTime) < time.Duration(f.cacheMinutes)*time.Minute {
		defer f.cacheMu.RUnlock()
		return f.indexCache, nil
	}
	f.cacheMu.RUnlock()

	url := f.registryURL + "/index.json"
	resp, err := f.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch index: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch index: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read index: %w", err)
	}

	var index Index
	if err := json.Unmarshal(data, &index); err != nil {
		return nil, fmt.Errorf("failed to parse index: %w", err)
	}

	f.cacheMu.Lock()
	f.indexCache = &index
	f.cacheTime = time.Now()
	f.cacheMu.Unlock()

	return &index, nil
}

// FetchSkillContent fetches the SKILL.md content for a skill
func (f *Fetcher) FetchSkillContent(skillPath string) (string, error) {
	if err := validatePath(skillPath); err != nil {
		return "", err
	}
	url := fmt.Sprintf("%s/%s/SKILL.md", f.registryURL, skillPath)
	resp, err := f.client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch skill content: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to fetch skill content: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read skill content: %w", err)
	}

	return string(data), nil
}

// FetchSkillMeta fetches the _meta.json for a skill
func (f *Fetcher) FetchSkillMeta(skillPath string) (map[string]interface{}, error) {
	if err := validatePath(skillPath); err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/%s/_meta.json", f.registryURL, skillPath)
	resp, err := f.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch skill meta: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch skill meta: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read skill meta: %w", err)
	}

	var meta map[string]interface{}
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("failed to parse skill meta: %w", err)
	}

	return meta, nil
}

// InvalidateCache clears the cached index
func (f *Fetcher) InvalidateCache() {
	f.cacheMu.Lock()
	f.indexCache = nil
	f.cacheMu.Unlock()
}

// validatePath checks that skillPath is safe (no path traversal)
func validatePath(skillPath string) error {
	if skillPath == "" {
		return fmt.Errorf("skill path cannot be empty")
	}
	if strings.Contains(skillPath, "..") || strings.Contains(skillPath, "./") || strings.HasPrefix(skillPath, "/") {
		return fmt.Errorf("invalid skill path: potential path traversal")
	}
	return nil
}