# Skill 管理与定时任务功能设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ClawHost Portal 添加 Skill 导入创建功能和定时任务管理界面

**Architecture:** Portal 前端提供 UI 入口，ClawHost 后端通过 kubectl exec 操作 OpenClaw Pod 内的文件和 CLI 命令。Skills 从 GitHub 下载内容后写入 Pod；定时任务通过执行 `openclaw cron` 命令管理。

**Tech Stack:** Next.js (Portal), Go/Echo (Backend), kubectl exec (K8s), GitHub API

---

## 功能概述

### 1. Skill 管理

用户可以导入和创建 Agent Skills：

| 功能 | 描述 |
|------|------|
| 从 GitHub 导入 | 输入 GitHub URL 或 `owner/repo@skill-name` 格式，自动下载并安装到 Pod |
| 从内容创建 | 通过表单填写 Skill 名称和 Markdown 内容，直接写入 Pod |
| 管理已安装 | 查看已安装 Skills 列表，支持删除 |

### 2. 定时任务管理

用户可以管理 OpenClaw Cron Jobs：

| 功能 | 描述 |
|------|------|
| 查看列表 | 显示所有定时任务及其调度表达式 |
| 启用/禁用 | 开关切换任务状态 |
| 立即执行 | 手动触发任务执行 |
| 删除 | 移除定时任务 |

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         Portal Frontend                          │
├─────────────────────────────────────────────────────────────────┤
│  /agents/[id]/skills/page.tsx                                   │
│  ├─ SkillList (已有)                                            │
│  ├─ SkillInstallFromGitHub — URL 输入 + 安装按钮                 │
│  └─ SkillCreateDialog — 名称 + 内容表单                         │
│                                                                 │
│  /agents/[id]/tasks/page.tsx (新增)                             │
│  └─ TaskList — 定时任务列表 + 操作按钮                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ API 调用
┌─────────────────────────────────────────────────────────────────┐
│                        ClawHost Backend                          │
├─────────────────────────────────────────────────────────────────┤
│  /api/v1/agents/:id/skills                                       │
│  ├─ GET — 列出 Skills (已有)                                    │
│  ├─ PUT /:name — 写入 Skill (已有)                              │
│  ├─ DELETE /:name — 删除 Skill (已有)                           │
│  ├─ POST /install — 从 GitHub 安装 (新增)                       │
│  └─ POST /create — 从内容创建 (新增)                            │
│                                                                 │
│  /api/v1/agents/:id/cron (新增)                                  │
│  ├─ GET — 列出定时任务                                          │
│  ├─ POST /:jobId/run — 立即执行                                 │
│  ├─ POST /:jobId/toggle — 启用/禁用                             │
│  └─ DELETE /:jobId — 删除任务                                   │
├─────────────────────────────────────────────────────────────────┤
│  GitHub Fetcher — 调用 GitHub API 获取 SKILL.md 内容             │
│  Skill Validator — 检查名称格式、内容大小、Markdown 结构          │
│  Cron Executor — 执行 openclaw cron 命令                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ kubectl exec
┌─────────────────────────────────────────────────────────────────┐
│                      OpenClaw Pod                                │
├─────────────────────────────────────────────────────────────────┤
│  Skills: {workspace}/.openclaw/skills/{skill-name}.md           │
│  Cron Jobs: ~/.openclaw/cron/jobs.json                          │
│  CLI: openclaw cron list/run/remove                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 后端 API 设计

### Skill 安装接口

**POST /api/v1/agents/:id/skills/install**

请求体：
```json
{
  "source": "github",
  "url": "https://github.com/owner/repo/tree/main/skills/my-skill"
}
// 或
{
  "source": "github",
  "spec": "owner/repo@my-skill"
}
```

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "my-skill",
    "installed": true
  }
}
```

处理流程：
1. 验证用户拥有 Agent (AgentOwnerAuth 中间件)
2. 解析 GitHub URL/spec，提取 owner、repo、skill-name
3. 调用 GitHub API 获取 SKILL.md 内容
4. 验证：名称格式 `[a-z0-9_-]+`、文件大小 < 100KB、有 YAML frontmatter
5. 调用 k8s.WriteSkill 写入 Pod
6. 返回成功

错误响应：
- 400: URL 格式无效、名称格式错误、内容过大
- 404: GitHub 仓库或 Skill 文件不存在
- 500: 写入 Pod 失败

### Skill 创建接口

**POST /api/v1/agents/:id/skills/create**

请求体：
```json
{
  "name": "my-custom-skill",
  "content": "---\nname: my-custom-skill\ndescription: ...\n---\n# My Skill\n..."
}
```

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "my-custom-skill",
    "created": true
  }
}
```

### Cron 任务列表接口

**GET /api/v1/agents/:id/cron**

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "jobs": [
      {
        "id": "job-123",
        "name": "Morning Brief",
        "schedule": "0 7 * * *",
        "timezone": "Asia/Shanghai",
        "enabled": true,
        "lastRun": "2026-04-03T07:00:00Z",
        "nextRun": "2026-04-04T07:00:00Z"
      }
    ]
  }
}
```

实现：执行 `openclaw cron list --json` 并解析输出

### Cron 立即执行接口

**POST /api/v1/agents/:id/cron/:jobId/run**

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "jobId": "job-123",
    "triggered": true
  }
}
```

实现：执行 `openclaw cron run <jobId>`

### Cron 启用/禁用接口

**POST /api/v1/agents/:id/cron/:jobId/toggle**

请求体：
```json
{
  "enabled": false
}
```

实现：执行 `openclaw cron edit <jobId> --enabled <true|false>`

如果 OpenClaw CLI 不支持 `--enabled` 参数，则直接修改 Pod 内 `~/.openclaw/cron/jobs.json` 文件中对应 job 的 `enabled` 字段，然后触发 Gateway 重新加载配置。

### Cron 删除接口

**DELETE /api/v1/agents/:id/cron/:jobId**

实现：执行 `openclaw cron remove <jobId>`

---

## GitHub URL 解析规则

| 输入格式 | 解析结果 |
|----------|----------|
| `owner/repo@skill-name` | → `https://api.github.com/repos/owner/repo/contents/skills/skill-name/SKILL.md` |
| `https://github.com/owner/repo/tree/main/skills/my-skill` | → 同上 |
| `https://github.com/owner/repo/tree/main/skills/my-skill/SKILL.md` | → 直接指向文件 |
| `https://raw.githubusercontent.com/owner/repo/main/skills/my-skill/SKILL.md` | → 直接下载 |

默认分支处理：未指定分支时使用 `main` 或 `master`

---

## 安全防护措施

| 风险 | 防护方案 |
|------|----------|
| 用户认证 | JWTAuth 中间件验证用户登录 |
| 所有权验证 | AgentOwnerAuth 验证 `agent.UserID == claims.UserID` |
| GitHub URL 欺骗 | 只允许 `github.com` 和 `raw.githubusercontent.com` 域名 |
| 路径穿越 | Skill 名称只允许 `[a-z0-9_-]+`，固定写入路径 |
| 内容过大 | 限制 Skill 文件大小 < 100KB |
| 恶意内容 | 检查必须有 YAML frontmatter (`---` 开头和结尾) |

---

## 前端设计

### Skills 页面改造

在现有 `/agents/[id]/skills/page.tsx` 基础上新增：

```
┌─────────────────────────────────────────────────────────────────┐
│  Skills 页面                                                    │
├─────────────────────────────────────────────────────────────────┤
│  glass-panel-header                                             │
│  ├─ "技能"                                                      │
│  ├─ [安装 Skill] 按钮                                           │
│  └─ [创建 Skill] 按钮                                           │
├─────────────────────────────────────────────────────────────────┤
│  glass-panel-content                                            │
│  │                                                              │
│  ├─ 安装区域 (可折叠 Dialog)                                    │
│  │  ├─ GitHub URL/Spec 输入框                                   │
│  │  ├─ 安装按钮                                                 │
│  │  └─ 安装状态/进度                                            │
│  │                                                              │
│  ├─ SkillList (已有)                                            │
│  │  ├─ skill-1.md  [删除]                                       │
│  │  ├─ skill-2.md  [删除]                                       │
│  │  └─ ...                                                      │
│  │                                                              │
│  └─ 空状态: "暂无技能，从 GitHub 导入或创建新技能"               │
└─────────────────────────────────────────────────────────────────┘
```

### 安装 Skill Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  从 GitHub 安装 Skill                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GitHub URL 或 Spec:                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ owner/repo@skill-name                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  示例: muranUSTB/skills-create_skills@skills-creator           │
│                                                                 │
│                              [取消]  [安装]                      │
└─────────────────────────────────────────────────────────────────┘
```

### 创建 Skill Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  创建新 Skill                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Skill 名称:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ my-skill                                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│  仅支持小写字母、数字、连字符和下划线                           │
│                                                                 │
│  内容 (Markdown):                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ---                                                     │    │
│  │ name: my-skill                                          │    │
│  │ description: My custom skill                            │    │
│  │ ---                                                     │    │
│  │ # My Skill                                              │    │
│  │                                                         │    │
│  │ Skill content here...                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│                              [取消]  [创建]                      │
└─────────────────────────────────────────────────────────────────┘
```

### Tasks 页面 (新增)

路径: `/agents/[id]/tasks/page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  定时任务                                                       │
├─────────────────────────────────────────────────────────────────┤
│  glass-panel-content                                            │
│  │                                                              │
│  ├─ TaskItem                                                    │
│  │  ├─ ● Morning Brief                                         │
│  │  ├─ 0 7 * * * (Asia/Shanghai)                               │
│  │  ├─ Switch [开]                                             │
│  │  ├─ [执行] 按钮                                             │
│  │  └─ [删除] 按钮                                             │
│  │                                                              │
│  ├─ TaskItem                                                    │
│  │  ├─ ○ Weekly Report                                         │
│  │  ├─ 0 6 * * 1 (UTC)                                         │
│  │  ├─ Switch [关]                                             │
│  │  ├─ [执行] 按钮                                             │
│  │  └─ [删除] 按钮                                             │
│  │                                                              │
│  └─ 空状态: "暂无定时任务"                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## i18n 新增文案

### 中文 (zh.json)

```json
{
  "agent": {
    "skills": {
      "title": "技能",
      "install": "安装 Skill",
      "create": "创建 Skill",
      "installTitle": "从 GitHub 安装 Skill",
      "installPlaceholder": "owner/repo@skill-name",
      "installHint": "示例: muranUSTB/skills-create_skills@skills-creator",
      "installing": "安装中...",
      "installed": "Skill 安装成功",
      "installFailed": "安装失败",
      "createTitle": "创建新 Skill",
      "namePlaceholder": "my-skill",
      "nameHint": "仅支持小写字母、数字、连字符和下划线",
      "contentPlaceholder": "---\nname: my-skill\ndescription: ...\n---\n# My Skill\n...",
      "creating": "创建中...",
      "created": "Skill 创建成功",
      "delete": "删除技能",
      "deleteConfirm": "确定要删除 \"{name}\" 吗？",
      "deleted": "技能已删除",
      "empty": "暂无技能，从 GitHub 导入或创建新技能"
    },
    "tasks": {
      "title": "定时任务",
      "empty": "暂无定时任务",
      "run": "执行",
      "running": "执行中...",
      "ran": "任务已触发",
      "delete": "删除任务",
      "deleteConfirm": "确定要删除 \"{name}\" 吗？",
      "deleted": "任务已删除",
      "enabled": "已启用",
      "disabled": "已禁用",
      "lastRun": "上次执行",
      "nextRun": "下次执行"
    }
  }
}
```

### 英文 (en.json)

```json
{
  "agent": {
    "skills": {
      "title": "Skills",
      "install": "Install Skill",
      "create": "Create Skill",
      "installTitle": "Install Skill from GitHub",
      "installPlaceholder": "owner/repo@skill-name",
      "installHint": "Example: muranUSTB/skills-create_skills@skills-creator",
      "installing": "Installing...",
      "installed": "Skill installed successfully",
      "installFailed": "Installation failed",
      "createTitle": "Create New Skill",
      "namePlaceholder": "my-skill",
      "nameHint": "Only lowercase letters, numbers, hyphens and underscores",
      "contentPlaceholder": "---\nname: my-skill\ndescription: ...\n---\n# My Skill\n...",
      "creating": "Creating...",
      "created": "Skill created successfully",
      "delete": "Delete Skill",
      "deleteConfirm": "Are you sure you want to delete \"{name}\"?",
      "deleted": "Skill deleted",
      "empty": "No skills yet. Install from GitHub or create a new one."
    },
    "tasks": {
      "title": "Scheduled Tasks",
      "empty": "No scheduled tasks",
      "run": "Run",
      "running": "Running...",
      "ran": "Task triggered",
      "delete": "Delete Task",
      "deleteConfirm": "Are you sure you want to delete \"{name}\"?",
      "deleted": "Task deleted",
      "enabled": "Enabled",
      "disabled": "Disabled",
      "lastRun": "Last run",
      "nextRun": "Next run"
    }
  }
}
```

---

## 文件变更清单

### 后端新增文件

| 文件 | 描述 |
|------|------|
| `handler/api/v1/agent_skill_install.go` | Skill 安装 handler |
| `handler/api/v1/agent_cron.go` | Cron 任务管理 handler |
| `service/github/skill_fetcher.go` | GitHub 内容获取 |
| `service/k8s/cron.go` | Cron CLI 执行封装 |

### 后端修改文件

| 文件 | 变更 |
|------|------|
| `cmd/server.go` | 添加新路由 |
| `service/k8s/workspace.go` | 可能需要调整 WriteSkill |

### 前端新增文件

| 文件 | 描述 |
|------|------|
| `src/app/(dashboard)/agents/[id]/tasks/page.tsx` | 定时任务页面 |
| `src/components/skill-install-dialog.tsx` | 安装 Skill Dialog |
| `src/components/skill-create-dialog.tsx` | 创建 Skill Dialog |
| `src/components/task-list.tsx` | 定时任务列表组件 |

### 前端修改文件

| 文件 | 变更 |
|------|------|
| `src/app/(dashboard)/agents/[id]/skills/page.tsx` | 添加安装/创建按钮 |
| `src/components/skill-list.tsx` | 更新空状态文案 |
| `src/lib/actions.ts` | 添加新 API 调用函数 |
| `src/messages/zh.json` | 添加 i18n 文案 |
| `src/messages/en.json` | 添加 i18n 文案 |
| `src/components/agent-detail-header.tsx` | 添加 Tasks 导航项 |

---

## 依赖说明

- GitHub API: 无需认证可访问公开仓库，有 60 req/hour 限制；建议配置 GitHub Token 提升限额
- OpenClaw CLI: 需要 OpenClaw Pod 内有 `openclaw` 命令可用
- kubectl exec: ClawHost 已有 K8s client 配置