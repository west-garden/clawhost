# Skill Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add skill marketplace feature allowing users to browse and install skills from a GitHub registry repository.

**Architecture:** ClawHost backend fetches skill list from GitHub raw URLs, caches in-memory. Portal frontend displays marketplace with two-tab layout (Marketplace + Installed). Users can search, filter by category, and install skills directly.

**Tech Stack:** Go (Echo), Next.js Portal, GitHub raw CDN

---

## File Structure

**Backend (new):**
- `service/marketplace/fetcher.go` - Fetches index.json and skill files from GitHub raw
- `handler/api/v1/marketplace_list.go` - GET /api/v1/marketplace/skills endpoint
- `handler/api/v1/marketplace_install.go` - POST /api/v1/agents/:id/skills/install-marketplace

**Backend (modify):**
- `cmd/server.go` - Add marketplace routes

**Frontend (new):**
- `portal/src/components/marketplace-tab.tsx` - Marketplace browsing UI with search/filter
- `portal/src/components/marketplace-skill-card.tsx` - Skill card for marketplace

**Frontend (modify):**
- `portal/src/app/(dashboard)/agents/[id]/skills/page.tsx` - Add tab switching
- `portal/src/lib/actions.ts` - Add listMarketplaceSkills, installMarketplaceSkill
- `portal/src/messages/en.json` - Add marketplace i18n keys
- `portal/src/messages/zh.json` - Add marketplace i18n keys

**Registry Repository (new):**
- Clone `west-garden/clawhost-skills`
- Create `index.json`, `README.md`, example skill

---

### Task 1: Create Skill Registry Repository

**Files:**
- Clone: `git@github.com:west-garden/clawhost-skills.git`
- Create: `index.json`
- Create: `README.md`
- Create: `example-skill/SKILL.md`
- Create: `example-skill/_meta.json`

- [ ] **Step 1: Clone the repository**

```bash
cd /tmp
git clone git@github.com:west-garden/clawhost-skills.git
cd clawhost-skills
```

- [ ] **Step 2: Create README.md**

```markdown
# ClawHost Skills Registry

This repository contains official skills for ClawHost marketplace.

## Structure

Each skill is a directory containing:
- `SKILL.md` - Skill content with YAML frontmatter
- `_meta.json` - Metadata (name, description, author, version, category, tags)

## Installing Skills

Skills can be installed via ClawHost portal's Marketplace tab.

## Contributing

Add a new skill directory with SKILL.md and _meta.json, then update index.json.
```

- [ ] **Step 3: Create index.json**

```json
{
  "version": 1,
  "updated_at": "2026-04-04T12:00:00Z",
  "skills": [
    {
      "name": "example-skill",
      "display_name": "Example Skill",
      "description": "A sample skill demonstrating the skill format",
      "author": "clawhost",
      "version": "1.0.0",
      "category": "general",
      "tags": ["example", "demo"],
      "path": "example-skill"
    }
  ]
}
```

- [ ] **Step 4: Create example-skill directory and files**

```bash
mkdir -p example-skill
```

- [ ] **Step 5: Create example-skill/SKILL.md**

```markdown
---
name: Example Skill
description: A sample skill demonstrating the skill format
author: clawhost
version: 1.0.0
---

# Example Skill

This is an example skill that demonstrates the proper format for ClawHost skills.

## Purpose

This skill serves as a template for creating new skills.

## Usage

When you install this skill, the agent will understand the basic skill structure.
```

- [ ] **Step 6: Create example-skill/_meta.json**

```json
{
  "name": "Example Skill",
  "description": "A sample skill demonstrating the skill format",
  "author": "clawhost",
  "version": "1.0.0",
  "category": "general",
  "tags": ["example", "demo"]
}
```

- [ ] **Step 7: Commit and push**

```bash
git add .
git commit -m "init: create registry structure with example skill"
git push origin main
```

---

### Task 2: Create Marketplace Fetcher Service

**Files:**
- Create: `service/marketplace/fetcher.go`

- [ ] **Step 1: Create marketplace directory**

```bash
mkdir -p /root/clawhost/service/marketplace
```

- [ ] **Step 2: Write fetcher.go**

```go
package marketplace

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const (
	DefaultRegistryURL = "https://raw.githubusercontent.com/west-garden/clawhost-skills/main"
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
	Version   int          `json:"version"`
	UpdatedAt string       `json:"updated_at"`
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
		client: &http.Client{Timeout: 30 * time.Second},
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
```

- [ ] **Step 3: Commit**

```bash
cd /root/clawhost
git add service/marketplace/fetcher.go
git commit -m "feat: add marketplace fetcher service"
```

---

### Task 3: Create Marketplace List Endpoint

**Files:**
- Create: `handler/api/v1/marketplace_list.go`

- [ ] **Step 1: Write marketplace_list.go**

```go
package v1

import (
	"github.com/clawhost/clawhost/service/marketplace"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

var defaultFetcher = marketplace.NewFetcher("", 0)

// ListMarketplaceSkills lists skills from the marketplace registry
func ListMarketplaceSkills(c echo.Context) error {
	category := c.QueryParam("category")
	search := c.QueryParam("search")

	index, err := defaultFetcher.FetchIndex()
	if err != nil {
		return util.InternalError(c, "failed to fetch marketplace: "+err.Error())
	}

	// Filter skills
	var skills []marketplace.SkillListing
	var categories []string
	categorySet := make(map[string]bool)

	for _, skill := range index.Skills {
		// Collect all categories
		if skill.Category != "" {
			categorySet[skill.Category] = true
		}

		// Filter by category
		if category != "" && skill.Category != category {
			continue
		}

		// Filter by search (matches name, display_name, description)
		if search != "" {
			searchLower := searchLower(search)
			if !containsLower(skill.Name, searchLower) &&
				!containsLower(skill.DisplayName, searchLower) &&
				!containsLower(skill.Description, searchLower) {
				continue
			}
		}

		skills = append(skills, skill)
	}

	// Build category list
	for cat := range categorySet {
		categories = append(categories, cat)
	}

	return util.Success(c, map[string]interface{}{
		"skills":     skills,
		"categories": categories,
	})
}

func searchLower(s string) string {
	// Simple lowercase conversion
	result := make([]byte, len(s))
	for i, c := range s {
		if c >= 'A' && c <= 'Z' {
			result[i] = byte(c - 'A' + 'a')
		} else {
			result[i] = byte(c)
		}
	}
	return string(result)
}

func containsLower(s, search string) bool {
	sLower := searchLower(s)
	for i := 0; i <= len(sLower)-len(search); i++ {
		if sLower[i:i+len(search)] == search {
			return true
		}
	}
	return false
}
```

- [ ] **Step 2: Commit**

```bash
git add handler/api/v1/marketplace_list.go
git commit -m "feat: add marketplace list endpoint"
```

---

### Task 4: Create Marketplace Install Endpoint

**Files:**
- Create: `handler/api/v1/marketplace_install.go`

- [ ] **Step 1: Write marketplace_install.go**

```go
package v1

import (
	"context"
	"encoding/json"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/service/k8s"
	"github.com/clawhost/clawhost/service/marketplace"
	"github.com/clawhost/clawhost/service/skills"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

type InstallMarketplaceRequest struct {
	SkillName string `json:"skill_name" validate:"required"`
}

// InstallMarketplaceSkill installs a skill from the marketplace
func InstallMarketplaceSkill(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running, cannot install skills")
	}

	var req InstallMarketplaceRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.SkillName == "" {
		return util.BadRequest(c, "skill_name is required")
	}

	// Find skill in index to get path
	index, err := defaultFetcher.FetchIndex()
	if err != nil {
		return util.InternalError(c, "failed to fetch marketplace: "+err.Error())
	}

	var skillPath string
	for _, skill := range index.Skills {
		if skill.Name == req.SkillName || skill.Path == req.SkillName {
			skillPath = skill.Path
			break
		}
	}

	if skillPath == "" {
		return util.BadRequest(c, "skill not found in marketplace")
	}

	ctx := context.Background()

	// Fetch skill content
	content, err := defaultFetcher.FetchSkillContent(skillPath)
	if err != nil {
		return util.InternalError(c, "failed to fetch skill content: "+err.Error())
	}

	// Fetch skill meta
	metaRaw, err := defaultFetcher.FetchSkillMeta(skillPath)
	if err != nil {
		// Non-critical, we'll extract from content
		metaRaw = nil
	}

	// Write skill to pod
	if err := k8s.WriteSkill(ctx, agent.ID, "main", skillPath, content); err != nil {
		return util.InternalError(c, "failed to write skill: "+err.Error())
	}

	// Write metadata
	meta := &skills.SkillMeta{}
	if metaRaw != nil {
		if name, ok := metaRaw["name"].(string); ok {
			meta.Name = name
		}
		if desc, ok := metaRaw["description"].(string); ok {
			meta.Description = desc
		}
		if author, ok := metaRaw["author"].(string); ok {
			meta.Author = author
		}
		if version, ok := metaRaw["version"].(string); ok {
			meta.Version = version
		}
	}
	meta.Source = "marketplace"

	// Also try to extract from content as backup
	contentMeta := extractMetaFromContent(content)
	if meta.Name == "" && contentMeta.Name != "" {
		meta.Name = contentMeta.Name
	}
	if meta.Description == "" && contentMeta.Description != "" {
		meta.Description = contentMeta.Description
	}
	if meta.Author == "" && contentMeta.Author != "" {
		meta.Author = contentMeta.Author
	}
	if meta.Version == "" && contentMeta.Version != "" {
		meta.Version = contentMeta.Version
	}

	if err := skills.WriteSkillMeta(ctx, agent.ID, "main", skillPath, meta); err != nil {
		// Non-critical error
	}

	return util.Success(c, map[string]interface{}{
		"name":      skillPath,
		"installed": true,
	})
}

// extractMetaFromContent is already defined in agent_skill_install.go
// We can reuse it by referencing the existing function
// Since it's in the same package, we just use it directly
```

- [ ] **Step 2: Update agent_skill_install.go to export extractMetaFromContent**

Modify `handler/api/v1/agent_skill_install.go` - the `extractMetaFromContent` function is already in this file and can be used directly since marketplace_install.go is in the same package.

- [ ] **Step 3: Commit**

```bash
git add handler/api/v1/marketplace_install.go
git commit -m "feat: add marketplace install endpoint"
```

---

### Task 5: Add Marketplace Routes to Server

**Files:**
- Modify: `cmd/server.go`

- [ ] **Step 1: Find the route registration section**

Read `cmd/server.go` to find where routes are registered (look for `v1.Group`).

- [ ] **Step 2: Add marketplace routes**

Add these routes in the v1 group (after existing skill routes):

```go
// Marketplace routes (public, no auth required for listing)
v1.GET("/marketplace/skills", v1.ListMarketplaceSkills)

// Marketplace install (requires agent auth)
agentGroup := v1.Group("/agents/:id", middleware.BotOwnerAuth)
agentGroup.POST("/skills/install-marketplace", v1.InstallMarketplaceSkill)
```

Note: The actual route structure may vary - check existing patterns in server.go. The install endpoint should be under the agent group with BotOwnerAuth middleware.

- [ ] **Step 3: Commit**

```bash
git add cmd/server.go
git commit -m "feat: add marketplace API routes"
```

---

### Task 6: Add Portal Marketplace Actions

**Files:**
- Modify: `portal/src/lib/actions.ts`

- [ ] **Step 1: Add listMarketplaceSkills function**

Append to `portal/src/lib/actions.ts`:

```typescript
export async function listMarketplaceSkills(
  category?: string,
  search?: string
) {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (search) params.append("search", search);

  const queryString = params.toString();
  const path = queryString
    ? `/api/v1/marketplace/skills?${queryString}`
    : "/api/v1/marketplace/skills";

  const res = await fetchWithAuth(path);
  const data = (await res.json()) as ApiResponse<{
    skills: MarketplaceSkill[];
    categories: string[];
  }>;

  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to fetch marketplace" };
  }

  return {
    skills: data.data?.skills || [],
    categories: data.data?.categories || [],
  };
}

export async function installMarketplaceSkill(agentId: string, skillName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/skills/install-marketplace`,
    {
      method: "POST",
      body: JSON.stringify({ skill_name: skillName }),
    }
  );

  const data = (await res.json()) as ApiResponse<{ name: string; installed: boolean }>;
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to install skill" };
  }

  revalidatePath(`/agents/${agentId}/skills`);
  return { success: true, name: data.data?.name };
}
```

- [ ] **Step 2: Add MarketplaceSkill type to types**

Append to `portal/src/types/index.ts` or create if needed:

```typescript
export interface MarketplaceSkill {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  path: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/lib/actions.ts portal/src/types/index.ts
git commit -m "feat: add marketplace actions to portal"
```

---

### Task 7: Add i18n Keys

**Files:**
- Modify: `portal/src/messages/en.json`
- Modify: `portal/src/messages/zh.json`

- [ ] **Step 1: Add English keys**

In `portal/src/messages/en.json`, add to `agent.skills` section:

```json
"skills": {
  // ... existing keys ...
  "marketplace": "Marketplace",
  "installedTab": "Installed",
  "searchPlaceholder": "Search skills...",
  "allCategories": "All Categories",
  "installFromMarketplace": "Install",
  "alreadyInstalled": "Installed",
  "byAuthor": "by {author}",
  "version": "v{version}"
}
```

- [ ] **Step 2: Add Chinese keys**

In `portal/src/messages/zh.json`, add to `agent.skills` section:

```json
"skills": {
  // ... existing keys ...
  "marketplace": "市场",
  "installedTab": "已安装",
  "searchPlaceholder": "搜索技能...",
  "allCategories": "全部分类",
  "installFromMarketplace": "安装",
  "alreadyInstalled": "已安装",
  "byAuthor": "作者: {author}",
  "version": "v{version}"
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/messages/en.json portal/src/messages/zh.json
git commit -m "feat: add marketplace i18n keys"
```

---

### Task 8: Create Marketplace Skill Card Component

**Files:**
- Create: `portal/src/components/marketplace-skill-card.tsx`

- [ ] **Step 1: Write component**

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { installMarketplaceSkill } from "@/lib/actions";
import { Loader2, Download, CheckCircle2 } from "lucide-react";

interface MarketplaceSkill {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  path: string;
}

interface Props {
  agentId: string;
  skill: MarketplaceSkill;
  isInstalled: boolean;
  onRefresh: () => void;
}

export function MarketplaceSkillCard({
  agentId,
  skill,
  isInstalled,
  onRefresh,
}: Props) {
  const t = useTranslations("agent.skills");
  const [loading, setLoading] = useState(false);

  async function handleInstall() {
    setLoading(true);
    const result = await installMarketplaceSkill(agentId, skill.name);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("installed"));
      onRefresh();
    }
  }

  return (
    <div className="p-4 rounded-lg bg-muted hover:bg-accent transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-medium text-foreground">
            {skill.display_name || skill.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("byAuthor", { author: skill.author })} · {t("version", { version: skill.version })}
          </p>
        </div>
        {isInstalled ? (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("alreadyInstalled")}</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleInstall}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            {t("installFromMarketplace")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-2">
        {skill.description}
      </p>
      <div className="flex gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
          {skill.category}
        </span>
        {skill.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/marketplace-skill-card.tsx
git commit -m "feat: add marketplace skill card component"
```

---

### Task 9: Create Marketplace Tab Component

**Files:**
- Create: `portal/src/components/marketplace-tab.tsx`

- [ ] **Step 1: Write component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketplaceSkillCard } from "./marketplace-skill-card";
import { listMarketplaceSkills } from "@/lib/actions";
import { RefreshCw, Search } from "lucide-react";

interface MarketplaceSkill {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  path: string;
}

interface Props {
  agentId: string;
  installedSkills: string[];
  onRefreshInstalled: () => void;
}

export function MarketplaceTab({
  agentId,
  installedSkills,
  onRefreshInstalled,
}: Props) {
  const t = useTranslations("agent.skills");
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
  }, [selectedCategory, search]);

  async function loadMarketplace() {
    setLoading(true);
    const result = await listMarketplaceSkills(
      selectedCategory || undefined,
      search || undefined
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      setSkills(result.skills);
      setCategories(result.categories);
    }
    setLoading(false);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value);
  }

  return (
    <div className="space-y-4">
      {/* Search and filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadMarketplace}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="text-muted-foreground text-sm">{t("loading")}</div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No skills found
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <MarketplaceSkillCard
              key={skill.name}
              agentId={agentId}
              skill={skill}
              isInstalled={installedSkills.includes(skill.name) || installedSkills.includes(skill.path)}
              onRefresh={onRefreshInstalled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/marketplace-tab.tsx
git commit -m "feat: add marketplace tab component"
```

---

### Task 10: Modify Skills Page to Add Tabs

**Files:**
- Modify: `portal/src/app/(dashboard)/agents/[id]/skills/page.tsx`

- [ ] **Step 1: Update page with tab switching**

Replace the current page content with tab layout:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkillList } from "@/components/skill-list";
import { MarketplaceTab } from "@/components/marketplace-tab";
import { SkillInstallDialog } from "@/components/skill-install-dialog";
import { SkillCreateDialog } from "@/components/skill-create-dialog";
import { listSkills } from "@/lib/actions";
import { useAgent } from "@/contexts/agent-context";
import { Download, Plus, RefreshCw } from "lucide-react";

interface Skill {
  name: string;
  name_display?: string;
  description?: string;
  author?: string;
  version?: string;
  installedAt?: number;
  source?: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const { isRunning } = useAgent();

  const [activeTab, setActiveTab] = useState<"marketplace" | "installed">("marketplace");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installOpen, setInstallOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!isRunning) {
      setLoading(false);
      setSkills([]);
      return;
    }
    loadSkills();
  }, [agentId, isRunning]);

  async function loadSkills() {
    setLoading(true);
    const result = await listSkills(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setSkills(result.skills || []);
    }
    setLoading(false);
  }

  // Get list of installed skill names for marketplace comparison
  const installedSkillNames = skills.map((s) => s.name);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.skills.title")}
          </span>
          <div className="flex gap-2">
            {/* Tab buttons */}
            <div className="flex border rounded-md p-1">
              <Button
                size="sm"
                variant={activeTab === "marketplace" ? "default" : "ghost"}
                onClick={() => setActiveTab("marketplace")}
                className="rounded-none first:rounded-l-md"
              >
                {t("agent.skills.marketplace")}
              </Button>
              <Button
                size="sm"
                variant={activeTab === "installed" ? "default" : "ghost"}
                onClick={() => setActiveTab("installed")}
                className="rounded-none last:rounded-r-md"
              >
                {t("agent.skills.installedTab")} ({skills.length})
              </Button>
            </div>
          </div>
        </div>
        <div className="glass-panel-content">
          {activeTab === "marketplace" ? (
            <MarketplaceTab
              agentId={agentId}
              installedSkills={installedSkillNames}
              onRefreshInstalled={loadSkills}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadSkills}
                  disabled={!isRunning || loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInstallOpen(true)}
                  disabled={!isRunning}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t("agent.skills.install")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  disabled={!isRunning}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("agent.skills.create")}
                </Button>
              </div>
              <SkillList
                agentId={agentId}
                skills={skills}
                loading={loading}
                onRefresh={loadSkills}
              />
            </div>
          )}
        </div>
      </div>

      <SkillInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />

      <SkillCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
        onSuccess={loadSkills}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/app/\(dashboard\)/agents/[id]/skills/page.tsx
git commit -m "feat: add marketplace/installed tabs to skills page"
```

---

### Task 11: Build and Test

- [ ] **Step 1: Build backend**

```bash
cd /root/clawhost
go build -o clawhost .
```

Expected: No errors

- [ ] **Step 2: Build frontend**

```bash
cd /root/clawhost/portal
npm run build
```

Expected: No errors

- [ ] **Step 3: Run backend server (manual testing)**

```bash
cd /root/clawhost
./clawhost server
```

- [ ] **Step 4: Test marketplace API**

```bash
curl http://localhost:18080/api/v1/marketplace/skills
```

Expected: JSON response with skills list from registry

- [ ] **Step 5: Final commit if needed**

```bash
git status
# If any uncommitted changes
git add -A
git commit -m "fix: resolve build issues"
```

---

## Self-Review

**Spec coverage:**
- ✓ Registry repository structure (Task 1)
- ✓ Backend fetcher service (Task 2)
- ✓ List endpoint (Task 3)
- ✓ Install endpoint (Task 4)
- ✓ Routes (Task 5)
- ✓ Portal actions (Task 6)
- ✓ i18n (Task 7)
- ✓ Skill card component (Task 8)
- ✓ Marketplace tab (Task 9)
- ✓ Skills page tabs (Task 10)
- ✓ Build/test (Task 11)

**Placeholder scan:** No TBD or TODO found.

**Type consistency:**
- MarketplaceSkill interface consistent across actions.ts, marketplace-skill-card.tsx, marketplace-tab.tsx
- SkillListing struct in Go matches JSON response structure