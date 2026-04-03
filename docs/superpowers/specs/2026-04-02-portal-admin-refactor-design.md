# ClawHost Portal & Admin Refactor — Design Spec

## Scope

This spec covers:

1. **Portal 功能完善** — 补全 Agent 配置管理、Skills 管理、Devices 配对、订阅购买流程
2. **Admin 后台修复** — 统一 JWT 认证、修复 API 路径、调整职责边界
3. **权限系统** — 用户角色、Agent 所有权、Admin API 权限控制

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
├────────────────────────────────┬────────────────────────────────────┤
│     Portal (portal/)           │     Admin (web/admin/)             │
│     用户门户                    │     管理后台                        │
│     - Agent 完全管理            │     - 用户管理                      │
│     - Skills/Channels/Devices   │     - 订阅管理                      │
│     - 订阅购买                  │     - 系统统计                      │
│     - 个人设置                  │     - Agent 查看（只读）             │
├────────────────────────────────┴────────────────────────────────────┤
│                     Next.js API Routes                               │
│                     (httpOnly cookie auth)                           │
├─────────────────────────────────────────────────────────────────────┤
│                     ClawHost API (Go + Echo)                         │
│                     /auth/* → JWT 认证                               │
│                     /api/v1/agents/* → 用户 Agent 操作               │
│                     /api/v1/admin/* → 管理员操作 (role: admin)       │
├─────────────────────────────────────────────────────────────────────┤
│                     Kubernetes + PostgreSQL                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Part 1: Portal 功能完善

### 1.1 Agent 配置管理

**后端 API（已有）：**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/agents/:id/config/models | 获取模型提供商列表 |
| POST | /api/v1/agents/:id/config/models | 添加模型提供商 |
| GET | /api/v1/agents/:id/config/models/:provider | 获取单个提供商 |
| PUT | /api/v1/agents/:id/config/models/:provider | 更新提供商 |
| DELETE | /api/v1/agents/:id/config/models/:provider | 删除提供商 |
| GET | /api/v1/agents/:id/config/defaults | 获取 Agent 默认配置 |
| PUT | /api/v1/agents/:id/config/defaults | 设置默认配置 |
| GET | /api/v1/agents/:id/config/raw | 获取原始 openclaw.json |
| PUT | /api/v1/agents/:id/config/raw | 更新原始配置 |

**前端新增页面：**

1. **配置 Tab** (`/agents/[id]/config`)
   - Models 面板：提供商列表、添加/编辑/删除对话框
   - Defaults 面板：默认模型、默认参数设置
   - Raw Config 面板：JSON 编辑器（高级用户）

2. **组件结构：**
   ```
   portal/src/app/(dashboard)/agents/[id]/config/page.tsx
   portal/src/components/config-models-panel.tsx
   portal/src/components/config-defaults-panel.tsx
   portal/src/components/config-raw-editor.tsx
   portal/src/components/model-provider-dialog.tsx
   ```

### 1.2 Skills 管理

**后端 API（已有）：**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/agents/:id/skills | 获取技能列表 |
| PUT | /api/v1/agents/:id/skills/:name | 更新技能 |
| DELETE | /api/v1/agents/:id/skills/:name | 删除技能 |

**前端新增页面：**

1. **Skills Tab** (`/agents/[id]/skills`)
   - 技能列表（卡片形式）
   - 查看/编辑技能内容
   - 删除技能（确认对话框）
   - 上传新技能（文件上传，后续功能）

2. **组件结构：**
   ```
   portal/src/app/(dashboard)/agents/[id]/skills/page.tsx
   portal/src/components/skill-list.tsx
   portal/src/components/skill-card.tsx
   portal/src/components/skill-editor-dialog.tsx
   ```

### 1.3 Devices 配对管理

**后端 API（已有）：**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/agents/:id/devices | 获取设备列表 |
| POST | /api/v1/agents/:id/devices/:request_id/approve | 批准配对 |
| DELETE | /api/v1/agents/:id/devices/:device_id | 撤销设备 |

**前端新增页面：**

1. **Devices Tab** (`/agents/[id]/devices`)
   - 待配对设备列表（显示 request_id、platform、IP、时间）
   - 已配对设备列表（显示 device_id、platform、状态）
   - 批准/撤销操作按钮
   - 实时刷新状态（WebSocket 或轮询）

2. **组件结构：**
   ```
   portal/src/app/(dashboard)/agents/[id]/devices/page.tsx
   portal/src/components/device-list.tsx
   portal/src/components/pending-device-card.tsx
   portal/src/components/paired-device-card.tsx
   ```

### 1.4 订阅购买流程

**后端 API（已有基础）：**
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/subscription/plans | 获取订阅套餐列表 |
| GET | /api/v1/subscription/credit-packs | 获取积分包列表 |
| GET | /api/v1/subscription/me | 获取当前用户订阅状态 |

**需要新增的 API：**
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/subscription/checkout | 创建 Stripe Checkout Session |
| POST | /api/v1/subscription/webhook | Stripe Webhook 回调 |
| POST | /api/v1/subscription/cancel | 取消订阅 |

**前端完善：**

1. **订阅页面** (`/subscription`)
   - 套餐对比卡片
   - 当前订阅状态显示
   - 购买按钮 → Stripe Checkout
   - 积分包购买

2. **购买流程：**
   ```
   用户点击购买 → POST /subscription/checkout
   → 返回 Stripe Checkout URL
   → 重定向到 Stripe
   → 支付成功 → Webhook 更新数据库
   → 重定向回 Portal 成功页面
   ```

3. **组件结构：**
   ```
   portal/src/app/(dashboard)/subscription/page.tsx (已有，需完善)
   portal/src/components/subscription-plans.tsx
   portal/src/components/credit-packs.tsx
   portal/src/components/current-subscription.tsx
   portal/src/app/(dashboard)/subscription/success/page.tsx
   ```

---

## Part 2: Admin 后台修复与职责调整

### 2.1 问题诊断

**当前问题：**
1. API 路径错误：前端 `/bot/api/v1/admin` → 后端 `/api/v1/admin`
2. 认证方式过时：前端使用静态 token，后端已改为 JWT
3. 职责不清：Admin 可以创建 Agent，与 Portal 功能重叠

### 2.2 修复方案

**认证统一：**

Admin 后台使用与 Portal 相同的 JWT 认证流程：
- 登录页面调用 `/auth/login`
- 用户必须有 `role: "admin"` 才能访问 Admin API
- JWT 存储在 httpOnly cookie 中

**API 路径修复：**

```typescript
// web/admin/src/lib/api.ts
const API_BASE = "/api/v1/admin";  // 移除 /bot/ 前缀
```

**添加登录页面：**

Admin 需要独立的登录入口（与 Portal 共用认证 API）：
```
web/admin/src/app/page.tsx → 重定向到 /login（未认证）或 /dashboard（已认证）
web/admin/src/app/login/page.tsx → Admin 登录页面
```

### 2.3 职责调整

**Admin 保留功能：**
| 功能 | 说明 |
|------|------|
| 用户管理 | 查看用户列表、编辑角色/状态 |
| 订阅管理 | 创建/编辑订阅套餐和积分包、手动授权订阅 |
| 系统统计 | 用户数、Agent 数、运行数 |
| Agent 查看 | 只读查看所有 Agent（不创建/不编辑） |

**Admin 移除功能：**
| 功能 | 原因 |
|------|------|
| 创建 Agent | 用户在 Portal 自己创建 |
| 启动/停止 Agent | 用户在 Portal 自己管理 |
| Apps 管理 | App 模型已移除 |

**Admin 新增功能：**
| 功能 | 说明 |
|------|------|
| 订阅授权 | 手动为用户分配订阅 |
| 积分调整 | 手动增减用户积分 |

### 2.4 Admin 前端重构

**新页面结构：**
```
web/admin/src/app/
├── login/page.tsx              # 登录页面
├── page.tsx                    # Dashboard（重定向或统计概览）
├── users/page.tsx              # 用户管理
├── agents/page.tsx             # Agent 列表（只读）
├── subscription/
│   ├── plans/page.tsx          # 套餐管理
│   ├── packs/page.tsx          # 积分包管理
│   └── grants/page.tsx         # 授权管理
└── layout.tsx                  # 布局（含侧边栏）
```

**组件更新：**
```
web/admin/src/components/
├── app-sidebar.tsx             # 更新导航
├── auth-provider.tsx           # 使用 JWT cookie
├── login-form.tsx              # 登录表单
└── admin-route-guard.tsx       # 权限守卫
```

---

## Part 3: 权限系统架构

### 3.1 用户角色

| 角色 | 权限 |
|------|------|
| `user` | 管理自己的 Agent、订阅、个人设置 |
| `admin` | 所有用户权限 + 管理用户、管理订阅套餐、查看所有 Agent |

### 3.2 后端权限中间件

```
请求流程：
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JWTAuth Middleware                           │
│  1. 从 Authorization header 提取 Bearer token                    │
│  2. 验证 JWT 签名和有效期                                        │
│  3. 解析 claims: { user_id, email, role }                       │
│  4. 存储到 Echo context                                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AgentOwnerAuth Middleware                       │
│  用于 /api/v1/agents/:id/* 路由                                  │
│  1. 从 path param 获取 agent_id                                  │
│  2. 查询数据库获取 agent                                         │
│  3. 验证 agent.user_id == claims.user_id                        │
│  4. 存储 agent 到 context                                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AdminAuth Middleware                          │
│  用于 /api/v1/admin/* 路由                                       │
│  验证 claims.role == "admin"                                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Handler                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 前端权限控制

**Portal 前端：**

```typescript
// portal/src/app/(dashboard)/layout.tsx
// 验证用户已登录，否则重定向到 /login

// Server Component 中验证 JWT
const user = await getProfile();
if (!user) redirect("/login");
```

**Admin 前端：**

```typescript
// web/admin/src/components/admin-route-guard.tsx
// 验证用户已登录且 role === "admin"

export function AdminRouteGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Forbidden />;

  return children;
}
```

### 3.4 API 权限矩阵

| API 路径 | 认证 | 额外权限 |
|----------|------|----------|
| /auth/login | ❌ | - |
| /auth/register | ❌ | - |
| /auth/me | ✅ JWT | - |
| /api/v1/agents | ✅ JWT | - |
| /api/v1/agents/:id/* | ✅ JWT | AgentOwnerAuth |
| /api/v1/subscription/* | ✅ JWT | - |
| /api/v1/admin/* | ✅ JWT | AdminAuth |

---

## Part 4: 实现计划

### Phase 1: Admin 后台修复（优先）

1. 修复 Admin API 路径
2. 添加 Admin 登录页面
3. 实现 Admin Auth Provider（JWT）
4. 移除 Agent 创建功能
5. 调整侧边栏导航

### Phase 2: Portal 功能完善

1. Agent 配置管理页面
2. Skills 管理页面
3. Devices 配对页面
4. 订阅购买流程（Stripe 集成）

### Phase 3: 权限系统验证

1. 添加前端权限守卫
2. 测试角色隔离
3. 测试 Agent 所有权验证

---

## Part 5: 文件变更清单

### Portal 前端新增文件

```
portal/src/app/(dashboard)/agents/[id]/config/page.tsx
portal/src/app/(dashboard)/agents/[id]/skills/page.tsx
portal/src/app/(dashboard)/agents/[id]/devices/page.tsx
portal/src/app/(dashboard)/subscription/success/page.tsx
portal/src/components/config-models-panel.tsx
portal/src/components/config-defaults-panel.tsx
portal/src/components/config-raw-editor.tsx
portal/src/components/skill-list.tsx
portal/src/components/device-list.tsx
portal/src/lib/actions.ts (添加 config/skills/devices actions)
```

### Admin 前端修改文件

```
web/admin/src/lib/api.ts (修复 API_BASE)
web/admin/src/app/page.tsx (重定向逻辑)
web/admin/src/app/login/page.tsx (新增)
web/admin/src/app/bots/page.tsx → agents/page.tsx (重命名，改为只读)
web/admin/src/components/app-sidebar.tsx (更新导航)
web/admin/src/components/auth-provider.tsx (使用 JWT)
```

### 后端新增 API

```
handler/api/v1/subscription_checkout.go (Stripe Checkout)
handler/api/v1/subscription_webhook.go (Stripe Webhook)
```

---

## Part 6: 测试清单

### Portal 测试

- [ ] 用户登录/注册
- [ ] Agent 创建/启动/停止/删除
- [ ] Agent 配置管理（models/defaults/raw）
- [ ] Skills 查看/删除
- [ ] Devices 列表/批准/撤销
- [ ] 订阅页面展示
- [ ] 用户 A 无法访问用户 B 的 Agent

### Admin 测试

- [ ] Admin 登录（role=admin 用户）
- [ ] 普通 user 无法访问 Admin 页面
- [ ] 用户管理（列表/编辑角色）
- [ ] Agent 列表（只读，无创建按钮）
- [ ] 订阅套餐管理
- [ ] 积分包管理

### 权限测试

- [ ] 未登录用户重定向到登录页
- [ ] Agent 操作需要所有权验证
- [ ] Admin API 需要 admin 角色
- [ ] JWT 过期后刷新机制