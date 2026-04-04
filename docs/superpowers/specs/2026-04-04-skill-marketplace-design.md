# Skill Marketplace Design

## Overview

Add a skill marketplace feature to ClawHost, allowing users to browse and install skills from a centralized GitHub repository (`west-garden/clawhost-skills`). This provides a discovery mechanism beyond the current GitHub URL installation.

## Components

### 1. Skill Registry Repository

**Repository:** `git@github.com:west-garden/clawhost-skills.git`

**Structure:**
```
clawhost-skills/
├── README.md
├── index.json              # Skill list with metadata
├── example-skill/
│   ├── SKILL.md            # Skill content
│   └── _meta.json          # Skill metadata
├── code-review/
│   ├── SKILL.md
│   └── _meta.json
└── ...more skill directories
```

**index.json format:**
```json
{
  "version": 1,
  "updated_at": "2026-04-04T12:00:00Z",
  "skills": [
    {
      "name": "example-skill",
      "display_name": "Example Skill",
      "description": "A sample skill for demonstration",
      "author": "clawhost",
      "version": "1.0.0",
      "category": "general",
      "tags": ["example", "demo"],
      "path": "example-skill"
    }
  ]
}
```

**Categories:** `general`, `coding`, `productivity`, `automation`, `communication`

### 2. Backend API (ClawHost)

#### Endpoint 1: List Marketplace Skills

```
GET /api/v1/marketplace/skills?category={category}&search={keyword}
```

**Response:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "skills": [
      {
        "name": "code-review",
        "display_name": "Code Reviewer",
        "description": "...",
        "author": "clawhost",
        "version": "1.2.0",
        "category": "coding",
        "tags": ["code", "review"]
      }
    ],
    "categories": ["general", "coding", "productivity", "automation", "communication"]
  }
}
```

**Implementation:**
- Fetch `https://raw.githubusercontent.com/west-garden/clawhost-skills/main/index.json`
- Cache result for 5 minutes (in-memory)
- Filter by category if provided
- Search by keyword (matches name, display_name, description, tags)
- No authentication required (public marketplace)

#### Endpoint 2: Install Marketplace Skill

```
POST /api/v1/agents/{id}/skills/install-marketplace
Body: { "skill_name": "code-review" }
```

**Response:**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "code-review",
    "installed": true
  }
}
```

**Implementation:**
- Fetch SKILL.md from `https://raw.githubusercontent.com/west-garden/clawhost-skills/main/{skill_name}/SKILL.md`
- Fetch _meta.json from same path
- Write to pod: `k8s.WriteSkill(ctx, agentID, "main", skillName, content)`
- Write metadata: `skills.WriteSkillMeta(ctx, agentID, "main", skillName, meta)`
- Set source to "marketplace"
- Agent must be running (same requirement as current skill install)

### 3. Frontend UI (Portal)

**Skills Page redesign:** Two-tab layout

**Tab 1: Marketplace**
- Header: Search input + Category dropdown filter
- Skill grid: Cards showing display_name, description, author, version, category
- Install button per card
- Already-installed skills show "Installed" badge instead of button
- Refresh button to reload marketplace list

**Tab 2: Installed**
- Current functionality preserved
- Skill list with cards
- Delete button per card
- "Install from GitHub" and "Create New" buttons in header

**New components:**
- `marketplace-tab.tsx` - Marketplace browsing UI
- `marketplace-skill-card.tsx` - Card for marketplace skill
- Modify `skills/page.tsx` - Add tab switching

**New server actions:**
- `listMarketplaceSkills(agentId, category?, search?)` - Fetch marketplace list
- `installMarketplaceSkill(agentId, skillName)` - Install from marketplace

## Data Flow

```
User clicks "Marketplace" tab
    → Portal calls GET /api/v1/marketplace/skills
    → ClawHost fetches index.json from GitHub raw
    → ClawHost caches and returns filtered list
    → Portal displays skill cards

User clicks "Install" on a skill
    → Portal calls POST /api/v1/agents/{id}/skills/install-marketplace
    → ClawHost downloads SKILL.md and _meta.json from GitHub raw
    → ClawHost writes to K8s pod
    → Portal refreshes installed list
```

## Error Handling

- GitHub fetch failures: Return empty list with error message, allow retry
- Skill already installed: Return success, no duplicate installation
- Agent not running: Return 400 error (same as current install)
- Invalid skill_name: Return 404 from GitHub, ClawHost returns 400 to client

## Configuration

Optional config in `config.toml`:
```toml
[marketplace]
repo_url = "https://raw.githubusercontent.com/west-garden/clawhost-skills/main"
cache_minutes = 5
```

Default values if not configured:
- repo_url: `https://raw.githubusercontent.com/west-garden/clawhost-skills/main`
- cache_minutes: 5

## Scope

This spec covers:
- Skill registry repository setup
- Backend marketplace API (list + install)
- Frontend marketplace tab UI

Out of scope (future enhancements):
- Multiple registry sources
- Skill versioning/updates
- User skill submissions to registry
- Skill ratings/reviews