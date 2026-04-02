# Subscription & Credits System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription plans and credit packs with backend data model + API, sidebar navigation updates, and a subscription pricing page UI.

**Architecture:** Backend adds GORM models for subscription_plans, credit_packs, user_subscriptions, and credit_transactions tables with package-level DB functions following existing patterns. API handlers serve plan/pack listings and user subscription status. Frontend updates the sidebar to add 订阅/设置 nav items and creates a `/subscription` page with pricing cards.

**Tech Stack:** Go 1.24+ (Echo v4, GORM, Viper), Next.js 16, React 19, Tailwind CSS v4, next-intl, lucide-react. No tests (project convention).

**Spec:** `docs/superpowers/specs/2026-04-02-subscription-design.md`

---

## File Structure

### New Backend Files
| File | Purpose |
|------|---------|
| `model/subscription.go` | GORM models: SubscriptionPlan, CreditPack, UserSubscription, CreditTransaction + DB operations + AutoMigrate + seed |
| `handler/api/v1/subscription.go` | Public handlers: ListPlans, ListCreditPacks, GetMySubscription |
| `handler/api/v1/admin_subscription.go` | Admin handlers: CreatePlan, UpdatePlan, CreateCreditPack, UpdateCreditPack, GrantSubscription |

### New Frontend Files
| File | Purpose |
|------|---------|
| `portal/src/app/(dashboard)/subscription/page.tsx` | Subscription page server component |
| `portal/src/components/subscription-page.tsx` | Client component: tabs, pricing cards, credit packs, status banner |

### Modified Backend Files
| File | Change |
|------|--------|
| `model/agent.go` | Add subscription tables to `AutoMigrate()` |
| `cmd/server.go` | Register subscription + admin subscription routes |

### Modified Frontend Files
| File | Change |
|------|--------|
| `portal/src/components/agent-sidebar.tsx` | Add 订阅/设置 nav items between agent list and footer; simplify footer |
| `portal/src/types/index.ts` | Add SubscriptionPlan, CreditPack, UserSubscription types |
| `portal/src/lib/api.ts` | Add getSubscriptionPlans(), getCreditPacks(), getMySubscription() |
| `portal/src/messages/zh.json` | Add `subscription.*` i18n keys |
| `portal/src/messages/en.json` | Add `subscription.*` i18n keys |
| `portal/src/app/globals.css` | Add pricing card CSS classes |

---

## Task 1: Backend Data Model

**Files:**
- Create: `model/subscription.go`
- Modify: `model/agent.go`

- [ ] **Step 1: Create the subscription model file**

Create `model/subscription.go`:

```go
package model

import (
	"time"

	"github.com/clawhost/clawhost/util"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SubscriptionPlan represents an admin-defined subscription tier.
type SubscriptionPlan struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name           string         `json:"name" gorm:"type:varchar(100);not null"`
	Slug           string         `json:"slug" gorm:"type:varchar(50);uniqueIndex;not null"`
	Description    string         `json:"description" gorm:"type:text"`
	PriceCents     int            `json:"price_cents" gorm:"not null"`
	Currency       string         `json:"currency" gorm:"type:varchar(10);default:'cny'"`
	AgentLimit     int            `json:"agent_limit" gorm:"not null"`
	MonthlyCredits int            `json:"monthly_credits" gorm:"not null"`
	DailyBonus     int            `json:"daily_bonus" gorm:"default:200"`
	DailyBonusCap  int            `json:"daily_bonus_cap" gorm:"default:2000"`
	Features       datatypes.JSON `json:"features" gorm:"type:jsonb"`
	SortOrder      int            `json:"sort_order" gorm:"default:0"`
	Active         bool           `json:"active" gorm:"default:true"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// CreditPack represents a one-time purchasable credit pack.
type CreditPack struct {
	ID        string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name      string    `json:"name" gorm:"type:varchar(100);not null"`
	Credits   int       `json:"credits" gorm:"not null"`
	PriceCents int      `json:"price_cents" gorm:"not null"`
	Currency  string    `json:"currency" gorm:"type:varchar(10);default:'cny'"`
	Active    bool      `json:"active" gorm:"default:true"`
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CreditPack) TableName() string {
	return "credit_packs"
}

func (p *CreditPack) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// UserSubscription tracks a user's active subscription and credit balance.
type UserSubscription struct {
	ID                   string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID               string     `json:"user_id" gorm:"type:varchar(36);uniqueIndex;not null"`
	PlanID               *string    `json:"plan_id" gorm:"type:varchar(36)"`
	Status               string     `json:"status" gorm:"type:varchar(20);default:'none'"`
	CreditsBalance       int        `json:"credits_balance" gorm:"default:0"`
	BonusCredits         int        `json:"bonus_credits" gorm:"default:0"`
	CurrentPeriodStart   *time.Time `json:"current_period_start"`
	CurrentPeriodEnd     *time.Time `json:"current_period_end"`
	StripeSubscriptionID string     `json:"stripe_subscription_id,omitempty" gorm:"type:varchar(255)"`
	StripeCustomerID     string     `json:"stripe_customer_id,omitempty" gorm:"type:varchar(255)"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (UserSubscription) TableName() string {
	return "user_subscriptions"
}

func (s *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	if s.Status == "" {
		s.Status = "none"
	}
	return nil
}

// CreditTransaction is an audit log entry for credit changes.
type CreditTransaction struct {
	ID           string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID       string    `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Type         string    `json:"type" gorm:"type:varchar(50);not null"`
	Amount       int       `json:"amount" gorm:"not null"`
	BalanceAfter int       `json:"balance_after" gorm:"not null"`
	Description  string    `json:"description" gorm:"type:text"`
	ReferenceID  string    `json:"reference_id,omitempty" gorm:"type:varchar(255)"`
	CreatedAt    time.Time `json:"created_at"`
}

func (CreditTransaction) TableName() string {
	return "credit_transactions"
}

func (t *CreditTransaction) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}

// --- SubscriptionPlan DB operations ---

func ListActiveSubscriptionPlans() ([]*SubscriptionPlan, error) {
	var plans []*SubscriptionPlan
	if err := util.GetDB().Where("active = ?", true).Order("sort_order ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	return plans, nil
}

func GetSubscriptionPlanByID(id string) (*SubscriptionPlan, error) {
	var plan SubscriptionPlan
	if err := util.GetDB().Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func GetSubscriptionPlanBySlug(slug string) (*SubscriptionPlan, error) {
	var plan SubscriptionPlan
	if err := util.GetDB().Where("slug = ?", slug).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func CreateSubscriptionPlan(plan *SubscriptionPlan) error {
	return util.GetDB().Create(plan).Error
}

func UpdateSubscriptionPlan(plan *SubscriptionPlan) error {
	return util.GetDB().Save(plan).Error
}

// --- CreditPack DB operations ---

func ListActiveCreditPacks() ([]*CreditPack, error) {
	var packs []*CreditPack
	if err := util.GetDB().Where("active = ?", true).Order("sort_order ASC").Find(&packs).Error; err != nil {
		return nil, err
	}
	return packs, nil
}

func CreateCreditPack(pack *CreditPack) error {
	return util.GetDB().Create(pack).Error
}

func UpdateCreditPack(pack *CreditPack) error {
	return util.GetDB().Save(pack).Error
}

// --- UserSubscription DB operations ---

func GetUserSubscription(userID string) (*UserSubscription, error) {
	var sub UserSubscription
	if err := util.GetDB().Where("user_id = ?", userID).First(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func CreateUserSubscription(sub *UserSubscription) error {
	return util.GetDB().Create(sub).Error
}

func UpdateUserSubscription(sub *UserSubscription) error {
	return util.GetDB().Save(sub).Error
}

// GetOrCreateUserSubscription returns the subscription for a user, creating a default one if none exists.
func GetOrCreateUserSubscription(userID string) (*UserSubscription, error) {
	sub, err := GetUserSubscription(userID)
	if err == nil {
		return sub, nil
	}
	// Create default empty subscription
	sub = &UserSubscription{
		UserID: userID,
		Status: "none",
	}
	if err := CreateUserSubscription(sub); err != nil {
		return nil, err
	}
	return sub, nil
}

// --- CreditTransaction DB operations ---

func CreateCreditTransaction(tx *CreditTransaction) error {
	return util.GetDB().Create(tx).Error
}

func ListCreditTransactions(userID string, limit int) ([]*CreditTransaction, error) {
	var txs []*CreditTransaction
	if err := util.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&txs).Error; err != nil {
		return nil, err
	}
	return txs, nil
}

// --- Migration & Seed ---

func AutoMigrateSubscription() error {
	db := util.GetDB()
	if err := db.AutoMigrate(&SubscriptionPlan{}); err != nil {
		return err
	}
	if err := db.AutoMigrate(&CreditPack{}); err != nil {
		return err
	}
	if err := db.AutoMigrate(&UserSubscription{}); err != nil {
		return err
	}
	if err := db.AutoMigrate(&CreditTransaction{}); err != nil {
		return err
	}
	return seedSubscriptionData()
}

func seedSubscriptionData() error {
	db := util.GetDB()

	// Seed plans if none exist
	var planCount int64
	db.Model(&SubscriptionPlan{}).Count(&planCount)
	if planCount == 0 {
		plans := []SubscriptionPlan{
			{
				Name:           "基础版",
				Slug:           "basic",
				Description:    "驱动日常自动化工作流",
				PriceCents:     4000,
				Currency:       "cny",
				AgentLimit:     1,
				MonthlyCredits: 2800,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["搭建日常多步工作流","全自动提升个人效率"]`)),
				SortOrder:      1,
				Active:         true,
			},
			{
				Name:           "专业版",
				Slug:           "pro",
				Description:    "专为重度用户打造的进阶体验",
				PriceCents:     8000,
				Currency:       "cny",
				AgentLimit:     3,
				MonthlyCredits: 11000,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["运行复杂批量任务","处理中高频业务自动化需求"]`)),
				SortOrder:      2,
				Active:         true,
			},
			{
				Name:           "旗舰版",
				Slug:           "flagship",
				Description:    "满足规模化团队的极限需求",
				PriceCents:     20000,
				Currency:       "cny",
				AgentLimit:     10,
				MonthlyCredits: 37400,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["部署 7×24 小时高负载工作流","为规模化业务提供无限潜力"]`)),
				SortOrder:      3,
				Active:         true,
			},
		}
		for i := range plans {
			if err := db.Create(&plans[i]).Error; err != nil {
				return err
			}
		}
	}

	// Seed credit packs if none exist
	var packCount int64
	db.Model(&CreditPack{}).Count(&packCount)
	if packCount == 0 {
		packs := []CreditPack{
			{Name: "小包", Credits: 1000, PriceCents: 1500, Currency: "cny", SortOrder: 1, Active: true},
			{Name: "中包", Credits: 5000, PriceCents: 6000, Currency: "cny", SortOrder: 2, Active: true},
			{Name: "大包", Credits: 20000, PriceCents: 20000, Currency: "cny", SortOrder: 3, Active: true},
		}
		for i := range packs {
			if err := db.Create(&packs[i]).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
```

- [ ] **Step 2: Add subscription migration to the main AutoMigrate**

In `model/agent.go`, find the `AutoMigrate()` function and add subscription migration at the end:

```go
// In model/agent.go, replace the AutoMigrate function:
func AutoMigrate() error {
	// Migrate users table first
	if err := AutoMigrateUser(); err != nil {
		return err
	}
	if err := util.GetDB().AutoMigrate(&Agent{}); err != nil {
		return err
	}
	// Migrate subscription tables
	if err := AutoMigrateSubscription(); err != nil {
		return err
	}
	// Migrate existing agents without slug or access_token
	return migrateExistingAgents()
}
```

- [ ] **Step 3: Install datatypes dependency**

```bash
cd /Users/rain/code/west-garden/clawhost && go get gorm.io/datatypes
```

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/rain/code/west-garden/clawhost && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add model/subscription.go model/agent.go go.mod go.sum
git commit -m "feat: add subscription, credit pack, and user subscription models with seed data"
```

---

## Task 2: Backend API Handlers

**Files:**
- Create: `handler/api/v1/subscription.go`
- Create: `handler/api/v1/admin_subscription.go`
- Modify: `cmd/server.go`

- [ ] **Step 1: Create public subscription handlers**

Create `handler/api/v1/subscription.go`:

```go
package v1

import (
	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// ListSubscriptionPlans returns all active subscription plans.
func ListSubscriptionPlans(c echo.Context) error {
	plans, err := model.ListActiveSubscriptionPlans()
	if err != nil {
		return util.InternalError(c, "failed to list plans")
	}
	return util.Success(c, plans)
}

// ListCreditPacks returns all active credit packs.
func ListCreditPacks(c echo.Context) error {
	packs, err := model.ListActiveCreditPacks()
	if err != nil {
		return util.InternalError(c, "failed to list credit packs")
	}
	return util.Success(c, packs)
}

// GetMySubscription returns the current user's subscription status.
func GetMySubscription(c echo.Context) error {
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}

	sub, err := model.GetOrCreateUserSubscription(claims.UserID)
	if err != nil {
		return util.InternalError(c, "failed to get subscription")
	}

	// Include plan details if subscribed
	var plan *model.SubscriptionPlan
	if sub.PlanID != nil {
		plan, _ = model.GetSubscriptionPlanByID(*sub.PlanID)
	}

	return util.Success(c, map[string]interface{}{
		"plan":               plan,
		"status":             sub.Status,
		"credits_balance":    sub.CreditsBalance,
		"bonus_credits":      sub.BonusCredits,
		"current_period_end": sub.CurrentPeriodEnd,
	})
}
```

- [ ] **Step 2: Create admin subscription handlers**

Create `handler/api/v1/admin_subscription.go`:

```go
package v1

import (
	"time"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// AdminCreatePlan creates a new subscription plan.
func AdminCreatePlan(c echo.Context) error {
	var plan model.SubscriptionPlan
	if err := c.Bind(&plan); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if plan.Name == "" || plan.Slug == "" {
		return util.BadRequest(c, "name and slug are required")
	}
	if err := model.CreateSubscriptionPlan(&plan); err != nil {
		return util.InternalError(c, "failed to create plan")
	}
	return util.Success(c, plan)
}

// AdminUpdatePlan updates an existing subscription plan.
func AdminUpdatePlan(c echo.Context) error {
	id := c.Param("id")
	plan, err := model.GetSubscriptionPlanByID(id)
	if err != nil {
		return util.NotFound(c, "plan not found")
	}
	if err := c.Bind(plan); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	plan.ID = id // Ensure ID doesn't change
	if err := model.UpdateSubscriptionPlan(plan); err != nil {
		return util.InternalError(c, "failed to update plan")
	}
	return util.Success(c, plan)
}

// AdminCreateCreditPack creates a new credit pack.
func AdminCreateCreditPack(c echo.Context) error {
	var pack model.CreditPack
	if err := c.Bind(&pack); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if pack.Name == "" || pack.Credits == 0 {
		return util.BadRequest(c, "name and credits are required")
	}
	if err := model.CreateCreditPack(&pack); err != nil {
		return util.InternalError(c, "failed to create credit pack")
	}
	return util.Success(c, pack)
}

// AdminUpdateCreditPack updates an existing credit pack.
func AdminUpdateCreditPack(c echo.Context) error {
	id := c.Param("id")
	var pack model.CreditPack
	if err := util.GetDB().Where("id = ?", id).First(&pack).Error; err != nil {
		return util.NotFound(c, "credit pack not found")
	}
	if err := c.Bind(&pack); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	pack.ID = id
	if err := model.UpdateCreditPack(&pack); err != nil {
		return util.InternalError(c, "failed to update credit pack")
	}
	return util.Success(c, pack)
}

// AdminGrantSubscription manually grants a subscription or credits to a user.
func AdminGrantSubscription(c echo.Context) error {
	var req struct {
		UserID       string `json:"user_id"`
		PlanSlug     string `json:"plan_slug"`
		Credits      int    `json:"credits"`
		DurationDays int    `json:"duration_days"`
	}
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.UserID == "" {
		return util.BadRequest(c, "user_id is required")
	}

	sub, err := model.GetOrCreateUserSubscription(req.UserID)
	if err != nil {
		return util.InternalError(c, "failed to get subscription")
	}

	// Grant plan if specified
	if req.PlanSlug != "" {
		plan, err := model.GetSubscriptionPlanBySlug(req.PlanSlug)
		if err != nil {
			return util.NotFound(c, "plan not found")
		}
		sub.PlanID = &plan.ID
		sub.Status = "active"

		days := req.DurationDays
		if days == 0 {
			days = 30
		}
		now := time.Now()
		end := now.AddDate(0, 0, days)
		sub.CurrentPeriodStart = &now
		sub.CurrentPeriodEnd = &end

		// Grant monthly credits
		sub.CreditsBalance += plan.MonthlyCredits

		// Log the credit grant
		model.CreateCreditTransaction(&model.CreditTransaction{
			UserID:       req.UserID,
			Type:         "subscription_grant",
			Amount:       plan.MonthlyCredits,
			BalanceAfter: sub.CreditsBalance,
			Description:  "Subscription grant: " + plan.Name,
			ReferenceID:  plan.ID,
		})
	}

	// Grant additional credits if specified
	if req.Credits > 0 {
		sub.CreditsBalance += req.Credits

		model.CreateCreditTransaction(&model.CreditTransaction{
			UserID:       req.UserID,
			Type:         "admin_adjust",
			Amount:       req.Credits,
			BalanceAfter: sub.CreditsBalance,
			Description:  "Admin credit grant",
		})
	}

	if err := model.UpdateUserSubscription(sub); err != nil {
		return util.InternalError(c, "failed to update subscription")
	}

	return util.Success(c, sub)
}
```

- [ ] **Step 3: Register routes in server.go**

In `cmd/server.go`, add routes after the existing admin routes block. Find the line `admin.POST("/agents/restart", v1.RestartAllAgents)` and add after the closing `}`:

```go
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
		adminSub.POST("/plans", v1.AdminCreatePlan)
		adminSub.PUT("/plans/:id", v1.AdminUpdatePlan)
		adminSub.POST("/credit-packs", v1.AdminCreateCreditPack)
		adminSub.PUT("/credit-packs/:id", v1.AdminUpdateCreditPack)
		adminSub.POST("/grant", v1.AdminGrantSubscription)
	}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/rain/code/west-garden/clawhost && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add handler/api/v1/subscription.go handler/api/v1/admin_subscription.go cmd/server.go
git commit -m "feat: add subscription and credit pack API handlers"
```

---

## Task 3: Frontend i18n Keys and Types

**Files:**
- Modify: `portal/src/messages/zh.json`
- Modify: `portal/src/messages/en.json`
- Modify: `portal/src/types/index.ts`
- Modify: `portal/src/lib/api.ts`
- Modify: `portal/src/app/globals.css`

- [ ] **Step 1: Add subscription i18n keys to zh.json**

Add a new `"subscription"` section after `"chat"` in `portal/src/messages/zh.json`:

```json
  "subscription": {
    "title": "升级您的订阅计划",
    "nav": "订阅",
    "agentPlans": "Agent 订阅",
    "creditPacks": "积分包",
    "currentPlan": "当前计划",
    "freeTier": "免费用户",
    "upgradePrompt": "升级以获得更多 Agent 和积分",
    "creditsRemaining": "剩余积分",
    "expiresAt": "到期时间",
    "upgrade": "立即升级",
    "currentBadge": "当前计划",
    "purchase": "购买",
    "perMonth": "/月",
    "credits": "积分",
    "agents": "个 Agent",
    "features": "包含特权",
    "dailyBonus": "每日额外赠 {amount} 积分（上限 {cap}）",
    "topUpAnytime": "随时加购积分（按需付费）",
    "comingSoon": "支付功能即将上线，敬请期待"
  }
```

Also add to `"sidebar"`:

```json
  "sidebar": {
    "agents": "我的 Agent",
    "newAgent": "新建 Agent",
    "settings": "设置",
    "logout": "退出登录",
    "subscription": "订阅"
  }
```

- [ ] **Step 2: Add subscription i18n keys to en.json**

Add the same structure in `portal/src/messages/en.json`:

```json
  "subscription": {
    "title": "Upgrade Your Plan",
    "nav": "Subscription",
    "agentPlans": "Agent Plans",
    "creditPacks": "Credit Packs",
    "currentPlan": "Current Plan",
    "freeTier": "Free Tier",
    "upgradePrompt": "Upgrade for more Agents and credits",
    "creditsRemaining": "Credits remaining",
    "expiresAt": "Expires",
    "upgrade": "Upgrade Now",
    "currentBadge": "Current",
    "purchase": "Purchase",
    "perMonth": "/mo",
    "credits": "credits",
    "agents": "Agents",
    "features": "Includes",
    "dailyBonus": "Daily bonus: {amount} credits (cap {cap})",
    "topUpAnytime": "Top up credits anytime (pay as you go)",
    "comingSoon": "Payment coming soon, stay tuned"
  }
```

Also add to `"sidebar"`:

```json
  "sidebar": {
    "agents": "My Agents",
    "newAgent": "New Agent",
    "settings": "Settings",
    "logout": "Logout",
    "subscription": "Subscription"
  }
```

- [ ] **Step 3: Add TypeScript types**

Add to `portal/src/types/index.ts` after the `AgentConnectResponse` interface:

```ts
// --- Subscription ---

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  currency: string;
  agent_limit: number;
  monthly_credits: number;
  daily_bonus: number;
  daily_bonus_cap: number;
  features: string[];
  sort_order: number;
  active: boolean;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  plan: SubscriptionPlan | null;
  status: "active" | "expired" | "cancelled" | "none";
  credits_balance: number;
  bonus_credits: number;
  current_period_end: string | null;
}
```

- [ ] **Step 4: Add API functions**

Add to `portal/src/lib/api.ts` after `getProfile()`:

```ts
export async function getSubscriptionPlans() {
  return fetchApi<import("@/types").SubscriptionPlan[]>("/api/v1/subscription/plans");
}

export async function getCreditPacks() {
  return fetchApi<import("@/types").CreditPack[]>("/api/v1/subscription/credit-packs");
}

export async function getMySubscription() {
  return fetchApi<import("@/types").UserSubscription>("/api/v1/subscription/me");
}
```

- [ ] **Step 5: Add pricing card CSS**

Add inside `@layer components` in `portal/src/app/globals.css`:

```css
  .pricing-card {
    @apply glass-panel flex flex-col;
  }

  .pricing-card-active {
    @apply border-red-500/40;
  }

  .pricing-card-header {
    @apply p-5 border-b border-white/5;
  }

  .pricing-card-body {
    @apply p-5 flex-1;
  }

  .pricing-card-feature {
    @apply flex items-center gap-2 text-xs text-white/50 py-1;
  }
```

- [ ] **Step 6: Commit**

```bash
git add portal/src/messages/zh.json portal/src/messages/en.json portal/src/types/index.ts portal/src/lib/api.ts portal/src/app/globals.css
git commit -m "feat(portal): add subscription types, API functions, i18n keys, and CSS"
```

---

## Task 4: Update Sidebar Layout

**Files:**
- Modify: `portal/src/components/agent-sidebar.tsx`

- [ ] **Step 1: Rewrite AgentSidebarContent to add nav items and simplify footer**

Replace the entire `portal/src/components/agent-sidebar.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CreateAgentDialog } from "./create-agent-dialog";
import { LocaleSwitcher } from "./locale-switcher";
import { ClawIcon } from "./claw-icon";
import { Plus, Settings, LogOut, CreditCard } from "lucide-react";
import type { Agent, User } from "@/types";

const AGENT_COLORS = [
  "from-red-500 to-red-700",
  "from-blue-500 to-blue-700",
  "from-purple-500 to-purple-700",
  "from-amber-500 to-amber-700",
  "from-emerald-500 to-emerald-700",
  "from-pink-500 to-pink-700",
  "from-cyan-500 to-cyan-700",
  "from-orange-500 to-orange-700",
];

function getAgentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function getStatusDotClass(status: string): string {
  const map: Record<string, string> = {
    running: "status-dot-running",
    stopped: "status-dot-stopped",
    starting: "status-dot-starting",
    created: "status-dot-created",
    error: "status-dot-error",
  };
  return map[status] || "status-dot-created";
}

interface AgentSidebarContentProps {
  agents: Agent[];
  user: User;
  locale: string;
  onNavigate?: () => void;
}

export function AgentSidebarContent({
  agents,
  user,
  locale,
  onNavigate,
}: AgentSidebarContentProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const activeAgentId = pathname.match(/\/agents\/([^/]+)/)?.[1];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function navigateTo(path: string) {
    onNavigate?.();
    router.push(path);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
          <ClawIcon className="w-5 h-5" />
        </div>
        <span className="font-semibold text-base text-white">ClawHost</span>
      </div>

      {/* New Agent button */}
      <div className="px-3 pt-3 pb-1">
        <CreateAgentDialog>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-red-500/20 to-red-700/20 border border-red-500/30 text-red-400 text-xs font-medium hover:from-red-500/30 hover:to-red-700/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            {t("sidebar.newAgent")}
          </button>
        </CreateAgentDialog>
      </div>

      {/* Agent list label */}
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-white/30">
        Agents
      </div>

      {/* Agent list */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const initial = (agent.name || "?")[0].toUpperCase();
          const color = getAgentColor(agent.name);

          return (
            <a
              key={agent.id}
              href={`/agents/${agent.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(`/agents/${agent.id}`);
              }}
              className={cn(
                "agent-sidebar-item",
                isActive && "agent-sidebar-item-active"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-md bg-gradient-to-br flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0",
                  color
                )}
              >
                {initial}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium flex-1 truncate",
                  isActive ? "text-white" : "text-white/50"
                )}
              >
                {agent.name}
              </span>
              <div
                className={cn("status-dot", getStatusDotClass(agent.status))}
              />
            </a>
          );
        })}
      </nav>

      {/* Nav items: subscription + settings */}
      <div className="px-2 py-2 space-y-0.5 border-t border-white/10">
        <a
          href="/subscription"
          onClick={(e) => {
            e.preventDefault();
            navigateTo("/subscription");
          }}
          className={cn(
            "agent-sidebar-item",
            pathname === "/subscription" && "agent-sidebar-item-active"
          )}
        >
          <CreditCard
            className={cn(
              "w-4 h-4 flex-shrink-0",
              pathname === "/subscription" ? "text-white" : "text-white/40"
            )}
          />
          <span
            className={cn(
              "text-[13px] font-medium",
              pathname === "/subscription" ? "text-white" : "text-white/50"
            )}
          >
            {t("sidebar.subscription")}
          </span>
        </a>
        <a
          href="/settings"
          onClick={(e) => {
            e.preventDefault();
            navigateTo("/settings");
          }}
          className={cn(
            "agent-sidebar-item",
            pathname === "/settings" && "agent-sidebar-item-active"
          )}
        >
          <Settings
            className={cn(
              "w-4 h-4 flex-shrink-0",
              pathname === "/settings" ? "text-white" : "text-white/40"
            )}
          />
          <span
            className={cn(
              "text-[13px] font-medium",
              pathname === "/settings" ? "text-white" : "text-white/50"
            )}
          >
            {t("sidebar.settings")}
          </span>
        </a>
      </div>

      {/* Footer: user info + logout */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500/20 to-red-700/20 border border-white/10 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">
              {(user.name || user.email || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-white/60 truncate flex-1">
            {user.name || user.email}
          </span>
          <LocaleSwitcher locale={locale} />
          <button
            onClick={handleLogout}
            className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
            title={t("sidebar.logout")}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentSidebar({
  agents,
  user,
  locale,
}: {
  agents: Agent[];
  user: User;
  locale: string;
}) {
  return (
    <aside className="hidden md:flex h-full agent-sidebar">
      <AgentSidebarContent agents={agents} user={user} locale={locale} />
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add portal/src/components/agent-sidebar.tsx
git commit -m "feat(portal): add subscription and settings nav items to sidebar"
```

---

## Task 5: Create Subscription Page

**Files:**
- Create: `portal/src/app/(dashboard)/subscription/page.tsx`
- Create: `portal/src/components/subscription-page.tsx`

- [ ] **Step 1: Create the subscription page server component**

Create `portal/src/app/(dashboard)/subscription/page.tsx`:

```tsx
import { getSubscriptionPlans, getCreditPacks, getMySubscription } from "@/lib/api";
import { SubscriptionPage } from "@/components/subscription-page";

export default async function SubscriptionRoute() {
  const [plans, packs, subscription] = await Promise.all([
    getSubscriptionPlans(),
    getCreditPacks(),
    getMySubscription().catch(() => null),
  ]);

  return (
    <SubscriptionPage
      plans={plans}
      packs={packs}
      subscription={subscription}
    />
  );
}
```

- [ ] **Step 2: Create the subscription page client component**

Create `portal/src/components/subscription-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, CreditPack, UserSubscription } from "@/types";
import { Check, Zap, CreditCard } from "lucide-react";

type Tab = "plans" | "packs";

export function SubscriptionPage({
  plans,
  packs,
  subscription,
}: {
  plans: SubscriptionPlan[];
  packs: CreditPack[];
  subscription: UserSubscription | null;
}) {
  const t = useTranslations("subscription");
  const [activeTab, setActiveTab] = useState<Tab>("plans");

  const currentPlanId = subscription?.plan?.id;
  const isSubscribed = subscription?.status === "active";

  function handlePurchase() {
    toast.info(t("comingSoon"));
  }

  function formatPrice(cents: number): string {
    return `¥${(cents / 100).toFixed(0)}`;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      {/* Status banner */}
      <div className="glass-panel mb-6">
        <div className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {t("currentPlan")}:{" "}
                <span className="text-red-400">
                  {isSubscribed ? subscription.plan?.name : t("freeTier")}
                </span>
              </p>
              {!isSubscribed && (
                <p className="text-xs text-white/40">{t("upgradePrompt")}</p>
              )}
            </div>
          </div>
          {isSubscribed && subscription && (
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>
                {t("creditsRemaining")}:{" "}
                <span className="text-white font-medium">
                  {subscription.credits_balance.toLocaleString()}
                </span>
              </span>
              {subscription.current_period_end && (
                <span>
                  {t("expiresAt")}:{" "}
                  <span className="text-white/70">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-white mb-4">{t("title")}</h1>

      {/* Tabs */}
      <div className="flex gap-0 mb-6">
        <button
          onClick={() => setActiveTab("plans")}
          className={cn("view-tab", activeTab === "plans" && "view-tab-active")}
        >
          {t("agentPlans")}
        </button>
        <button
          onClick={() => setActiveTab("packs")}
          className={cn("view-tab", activeTab === "packs" && "view-tab-active")}
        >
          {t("creditPacks")}
        </button>
      </div>

      {/* Plans tab */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;

            return (
              <div
                key={plan.id}
                className={cn(
                  "pricing-card",
                  isCurrent && "pricing-card-active"
                )}
              >
                <div className="pricing-card-header">
                  <h3 className="text-base font-semibold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-white/40">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">
                      {formatPrice(plan.price_cents)}
                    </span>
                    <span className="text-sm text-white/40">
                      {t("perMonth")}
                    </span>
                  </div>
                  <button
                    onClick={handlePurchase}
                    disabled={isCurrent}
                    className={cn(
                      "w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isCurrent
                        ? "bg-white/10 text-white/40 cursor-default"
                        : "bg-gradient-to-r from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800"
                    )}
                  >
                    {isCurrent ? t("currentBadge") : t("upgrade")}
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                    {t("features")}
                  </p>
                  <div className="space-y-0.5">
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {plan.monthly_credits.toLocaleString()} {t("credits")}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {plan.agent_limit} {t("agents")}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {t("dailyBonus", {
                          amount: plan.daily_bonus,
                          cap: plan.daily_bonus_cap,
                        })}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>{t("topUpAnytime")}</span>
                    </div>
                    {(plan.features as string[])?.map(
                      (feature: string, i: number) => (
                        <div key={i} className="pricing-card-feature">
                          <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit packs tab */}
      {activeTab === "packs" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <div key={pack.id} className="pricing-card">
              <div className="pricing-card-header">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">
                    {pack.name}
                  </h3>
                </div>
                <p className="text-2xl font-bold text-white">
                  {pack.credits.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-white/40">
                    {t("credits")}
                  </span>
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">
                    {formatPrice(pack.price_cents)}
                  </span>
                </div>
                <button
                  onClick={handlePurchase}
                  className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800 transition-all"
                >
                  {t("purchase")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/app/\(dashboard\)/subscription/page.tsx portal/src/components/subscription-page.tsx
git commit -m "feat(portal): add subscription pricing page with plans and credit packs"
```

---

## Task 6: Build Verification

- [ ] **Step 1: Verify Go backend compiles**

```bash
cd /Users/rain/code/west-garden/clawhost && go build ./...
```

Expected: No errors.

- [ ] **Step 2: Verify frontend builds**

```bash
cd /Users/rain/code/west-garden/clawhost/portal && ./node_modules/.bin/next build
```

Expected: Build succeeds. Routes should include `/subscription`.

- [ ] **Step 3: Fix any build errors**

Address TypeScript errors, missing imports, or type mismatches.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(portal): fix subscription build issues"
```
