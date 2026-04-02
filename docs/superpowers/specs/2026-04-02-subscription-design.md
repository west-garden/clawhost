# Subscription & Credits System — Design Spec

## Overview

Add a subscription and credits system to ClawHost. Users subscribe to a monthly plan (基础版/专业版/旗舰版) which grants Agent slots and a base credit allowance. Users can also purchase one-time credit packs for additional usage (model calls, third-party API consumption). This iteration covers the backend data model + API and the frontend subscription page UI. Stripe integration is deferred to a future iteration.

## Sidebar Changes

Move "设置" out of the footer button area and add "订阅" as a navigation item. New sidebar order top-to-bottom:

```
┌──────────────┐
│ 🦀 ClawHost  │
├──────────────┤
│ + 新建 Agent  │
├──────────────┤
│ AGENTS       │
│ ● Agent 1    │
│ ● Agent 2    │
├──────────────┤
│ 💳 订阅       │
│ ⚙ 设置       │
├──────────────┤
│ 👤 Rain  EN  │
│ [退出登录]    │
└──────────────┘
```

- "订阅" and "设置" are navigation links styled like sidebar nav items (icon + text), placed between the agent list and the user footer.
- "订阅" links to `/subscription`, "设置" links to `/settings`.
- Active state: highlighted background when the current route matches.
- Footer simplified: user avatar + name + locale switcher + logout button only.

## Subscription Page (`/subscription`)

Renders in the right panel area (same layout shell as agent detail — sidebar stays visible). No agent detail header shown; the subscription page has its own content.

### Header

Title: "升级您的订阅计划"

### Tab Switcher

Two tabs directly below the title:
- **Agent 订阅** — Monthly subscription plans
- **积分包** — One-time credit pack purchases

Active tab has the coral underline (same `view-tab` / `view-tab-active` CSS pattern used in agent detail).

### Agent 订阅 Tab

Three pricing cards in a horizontal row (responsive: stack on mobile):

Each card contains:
- Plan name (基础版 / 专业版 / 旗舰版)
- Short description
- Price: ¥X/月
- "立即升级" button (or "当前计划" badge if user is on this plan)
- Feature list with checkmarks

Card data comes from `GET /api/v1/subscription/plans` API. The current user's plan is highlighted.

**Pricing (initial configuration, admin-adjustable):**

| Plan | Price | Agent Slots | Monthly Credits | Description |
|------|-------|-------------|-----------------|-------------|
| 基础版 | ¥40/月 | 1 | 2,800 | 驱动日常自动化工作流 |
| 专业版 | ¥80/月 | 3 | 11,000 | 专为重度用户打造的进阶体验 |
| 旗舰版 | ¥200/月 | 10 | 37,400 | 满足规模化团队的极限需求 |

Features listed per plan (similar to EasyClaw reference):
- X 积分
- X 个 Agent
- 每日额外赠 200 积分（上限 2000）
- 随时加购积分（按需付费）
- Plan-specific features

### 积分包 Tab

Grid of credit pack cards (2-3 options):

| Pack | Credits | Price |
|------|---------|-------|
| 小包 | 1,000 | ¥15 |
| 中包 | 5,000 | ¥60 |
| 大包 | 20,000 | ¥200 |

Each card: credit amount, price, "购买" button.

### Current Status Banner

At the top of the page (below title, above tabs), show a status bar:
- Current plan name + badge
- Credits remaining: "剩余积分: X"
- Plan expiry date (if subscribed)

If no subscription: "当前为免费用户" with a prompt to upgrade.

### Button Behavior (This Iteration)

Since Stripe is not yet integrated, clicking "立即升级" or "购买" shows a toast or modal: "支付功能即将上线，敬请期待" (Payment coming soon). The UI is fully built and wired to the API — only the actual payment flow is stubbed.

## Backend Data Model

### New Tables

**`subscription_plans`** — Admin-defined subscription tiers.

```
id              UUID        PK, default gen_random_uuid()
name            VARCHAR     NOT NULL (e.g., "基础版")
slug            VARCHAR     NOT NULL UNIQUE (e.g., "basic", "pro", "flagship")
description     TEXT
price_cents     INTEGER     NOT NULL (price in cents, e.g., 4000 = ¥40)
currency        VARCHAR     DEFAULT 'cny'
agent_limit     INTEGER     NOT NULL (max concurrent agents)
monthly_credits INTEGER     NOT NULL (credits granted per billing cycle)
daily_bonus     INTEGER     DEFAULT 200 (daily bonus credits)
daily_bonus_cap INTEGER     DEFAULT 2000 (max accumulated daily bonus)
features        JSONB       (additional feature flags/descriptions)
sort_order      INTEGER     DEFAULT 0 (display order)
active          BOOLEAN     DEFAULT true
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**`credit_packs`** — Admin-defined one-time credit packs.

```
id              UUID        PK
name            VARCHAR     NOT NULL (e.g., "小包")
credits         INTEGER     NOT NULL
price_cents     INTEGER     NOT NULL
currency        VARCHAR     DEFAULT 'cny'
active          BOOLEAN     DEFAULT true
sort_order      INTEGER     DEFAULT 0
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**`user_subscriptions`** — Tracks user's active subscription.

```
id              UUID        PK
user_id         UUID        FK → users.id, UNIQUE
plan_id         UUID        FK → subscription_plans.id, NULLABLE
status          VARCHAR     ('active', 'expired', 'cancelled', 'none')
credits_balance INTEGER     DEFAULT 0
bonus_credits   INTEGER     DEFAULT 0 (accumulated daily bonus)
current_period_start TIMESTAMP
current_period_end   TIMESTAMP
stripe_subscription_id VARCHAR  NULLABLE (for future Stripe integration)
stripe_customer_id     VARCHAR  NULLABLE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**`credit_transactions`** — Audit log for credit changes.

```
id              UUID        PK
user_id         UUID        FK → users.id
type            VARCHAR     ('subscription_grant', 'daily_bonus', 'pack_purchase', 'usage', 'admin_adjust')
amount          INTEGER     (positive = credit, negative = debit)
balance_after   INTEGER
description     TEXT
reference_id    VARCHAR     NULLABLE (e.g., pack ID, agent ID)
created_at      TIMESTAMP
```

### Seed Data

On first migration, seed `subscription_plans` with the three tiers and `credit_packs` with the three packs defined above.

## Backend API

All endpoints require `BearerAuth` (existing middleware).

### Public Endpoints

**`GET /api/v1/subscription/plans`**
Returns active subscription plans, sorted by `sort_order`.
Response: `{ code: 0, data: SubscriptionPlan[] }`

**`GET /api/v1/subscription/credit-packs`**
Returns active credit packs, sorted by `sort_order`.
Response: `{ code: 0, data: CreditPack[] }`

**`GET /api/v1/subscription/me`**
Returns current user's subscription status and credit balance.
Response:
```json
{
  "code": 0,
  "data": {
    "plan": { ... } | null,
    "status": "active" | "expired" | "none",
    "credits_balance": 2800,
    "bonus_credits": 400,
    "current_period_end": "2026-05-02T00:00:00Z"
  }
}
```

### Admin Endpoints

**`POST /api/v1/admin/subscription/plans`** — Create a plan.
**`PUT /api/v1/admin/subscription/plans/:id`** — Update a plan.
**`POST /api/v1/admin/subscription/credit-packs`** — Create a credit pack.
**`PUT /api/v1/admin/subscription/credit-packs/:id`** — Update a credit pack.
**`POST /api/v1/admin/subscription/grant`** — Manually grant a subscription or credits to a user (for testing/admin use before Stripe is connected).

```json
{
  "user_id": "...",
  "plan_slug": "pro",
  "credits": 5000,
  "duration_days": 30
}
```

## Portal Frontend Changes

### Modified Files

| File | Change |
|------|--------|
| `portal/src/components/agent-sidebar.tsx` | Add 订阅/设置 nav items between agent list and footer; simplify footer |
| `portal/src/components/mobile-header.tsx` | Same sidebar content change propagates via `AgentSidebarContent` |
| `portal/src/messages/zh.json` | Add `subscription.*` i18n keys |
| `portal/src/messages/en.json` | Add `subscription.*` i18n keys |
| `portal/src/types/index.ts` | Add `SubscriptionPlan`, `CreditPack`, `UserSubscription` types |
| `portal/src/lib/api.ts` | Add `getSubscriptionPlans()`, `getCreditPacks()`, `getMySubscription()` |

### New Files

| File | Purpose |
|------|---------|
| `portal/src/app/(dashboard)/subscription/page.tsx` | Subscription page (server component, fetches plans + user sub) |
| `portal/src/components/subscription-page.tsx` | Client component: tabs, pricing cards, credit packs, status banner |

## Visual Style

Same glass morphism design system. Pricing cards use `glass-panel` styling. Active plan card gets a coral border highlight. "立即升级" buttons use `glass-btn` (coral gradient). Tab switcher reuses `view-tab` / `view-tab-active` CSS.

## Routing

- `/subscription` — Subscription page, rendered within the dashboard layout (sidebar visible)
- Sidebar "订阅" link navigates here

## What's Deferred

- Stripe Checkout integration (payment flow)
- Stripe Webhooks (subscription lifecycle events)
- Credit usage tracking (deducting credits on API calls)
- Agent creation enforcement based on plan limits
- Daily bonus credit cron job
- Subscription expiry handling
