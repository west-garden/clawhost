# ClawHost Portal & Admin Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善 Portal 功能（配置、技能、设备、订阅）并修复 Admin 后台（统一 JWT 认证、修复 API 路径、调整职责）

**Architecture:** Portal 和 Admin 共享后端 JWT 认证，通过用户角色区分权限。Admin 使用 email/password 登录，验证 role=admin 后访问管理 API。

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Go (Echo), PostgreSQL

---

## File Structure

### Admin Frontend (web/admin/)

```
web/admin/src/
├── app/
│   ├── layout.tsx                    # 修改：添加 AdminRouteGuard
│   ├── page.tsx                      # 修改：重定向到 /users
│   ├── login/
│   │   └── page.tsx                  # 新增：登录页面
│   ├── users/
│   │   └── page.tsx                  # 修改：从现有代码迁移
│   ├── agents/
│   │   └── page.tsx                  # 重命名：bots → agents，改为只读
│   └── subscription/
│       ├── plans/page.tsx            # 新增：套餐管理
│       └── packs/page.tsx            # 新增：积分包管理
├── components/
│   ├── app-shell.tsx                 # 修改：移除 token 登录，使用 children 渲染
│   ├── app-sidebar.tsx               # 修改：更新导航
│   ├── auth-provider.tsx             # 重写：JWT cookie 认证
│   └── admin-route-guard.tsx         # 新增：admin 角色守卫
└── lib/
    └── api.ts                        # 修改：修复 API_BASE，使用 cookie 认证
```

### Portal Frontend (portal/)

```
portal/src/
├── app/(dashboard)/agents/[id]/
│   ├── config/page.tsx               # 新增：配置管理
│   ├── skills/page.tsx               # 新增：技能管理
│   └── devices/page.tsx              # 新增：设备配对
├── components/
│   ├── config-models-panel.tsx       # 新增
│   ├── config-defaults-panel.tsx     # 新增
│   ├── skill-list.tsx                # 新增
│   └── device-list.tsx               # 新增
└── lib/
    └── actions.ts                    # 修改：添加新 actions
```

---

## Phase 1: Admin 后台修复

### Task 1: 修复 Admin API 路径

**Files:**
- Modify: `web/admin/src/lib/api.ts`

- [ ] **Step 1: 修改 API_BASE 常量**

```typescript
// web/admin/src/lib/api.ts
// 修改第 1 行

// 旧代码:
const API_BASE = "/bot/api/v1/admin";

// 新代码:
const API_BASE = "/api/v1/admin";
```

- [ ] **Step 2: 移除 verifyToken 函数，改为使用 /auth/me**

```typescript
// web/admin/src/lib/api.ts
// 删除 verifyToken 函数（第 20-29 行），替换为:

export async function getProfile(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: 添加 User 类型定义**

```typescript
// web/admin/src/lib/api.ts
// 在文件顶部添加类型定义

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  created_at: string;
}
```

- [ ] **Step 4: 修改 request 函数使用 cookie 认证**

```typescript
// web/admin/src/lib/api.ts
// 修改 request 函数

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ code: number; message: string; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",  // 添加这行，使用 cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Request failed: ${res.status}`);
  }
  return json;
}
```

- [ ] **Step 5: 删除旧的 token 管理函数**

```typescript
// web/admin/src/lib/api.ts
// 删除以下函数:
// - setToken
// - getStoredToken
// - clearToken
// - getToken (内部函数)
```

- [ ] **Step 6: 提交更改**

```bash
git add web/admin/src/lib/api.ts
git commit -m "fix(admin): correct API path and switch to cookie auth"
```

---

### Task 2: 创建 Admin 登录 API 路由

**Files:**
- Create: `web/admin/src/app/api/auth/login/route.ts`
- Create: `web/admin/src/app/api/auth/me/route.ts`
- Create: `web/admin/src/app/api/auth/logout/route.ts`

- [ ] **Step 1: 创建登录 API 路由**

```typescript
// web/admin/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.code !== 0 || !data.data) {
    return NextResponse.json(
      { message: data.message || "Login failed" },
      { status: res.status }
    );
  }

  const { access_token, refresh_token, user } = data.data;

  // 检查是否为 admin
  if (user.role !== "admin") {
    return NextResponse.json(
      { message: "Admin access required" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ user });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set("admin_token", access_token, cookieOptions);
  response.cookies.set("admin_refresh", refresh_token, cookieOptions);

  return response;
}
```

- [ ] **Step 2: 创建获取当前用户 API 路由**

```typescript
// web/admin/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.CLAWHOST_API_URL || "http://localhost:18080";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const data = await res.json();
  return NextResponse.json({ user: data.data });
}
```

- [ ] **Step 3: 创建登出 API 路由**

```typescript
// web/admin/src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("admin_token");
  response.cookies.delete("admin_refresh");
  return response;
}
```

- [ ] **Step 4: 提交更改**

```bash
git add web/admin/src/app/api/
git commit -m "feat(admin): add JWT auth API routes"
```

---

### Task 3: 重写 Admin Auth Provider

**Files:**
- Rewrite: `web/admin/src/components/auth-provider.tsx`

- [ ] **Step 1: 重写 auth-provider.tsx**

```typescript
// web/admin/src/components/auth-provider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAuthed: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthed: false,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.role === "admin") {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || "Login failed" };
      }

      setUser(data.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: "Login failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: 提交更改**

```bash
git add web/admin/src/components/auth-provider.tsx
git commit -m "refactor(admin): rewrite auth provider for JWT"
```

---

### Task 4: 创建 Admin 登录页面

**Files:**
- Create: `web/admin/src/app/login/page.tsx`

- [ ] **Step 1: 创建登录页面**

```typescript
// web/admin/src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await login(email, password);

    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">ClawHost Admin</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with your admin account
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交更改**

```bash
git add web/admin/src/app/login/page.tsx
git commit -m "feat(admin): add login page with email/password"
```

---

### Task 5: 修改 AppShell 组件

**Files:**
- Modify: `web/admin/src/components/app-shell.tsx`

- [ ] **Step 1: 简化 AppShell，移除登录逻辑**

```typescript
// web/admin/src/components/app-shell.tsx
"use client";

import { useAuth } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: 提交更改**

```bash
git add web/admin/src/components/app-shell.tsx
git commit -m "refactor(admin): simplify AppShell, remove inline login"
```

---

### Task 6: 添加 AdminRouteGuard 和修改 Layout

**Files:**
- Create: `web/admin/src/components/admin-route-guard.tsx`
- Modify: `web/admin/src/app/layout.tsx`

- [ ] **Step 1: 创建 AdminRouteGuard**

```typescript
// web/admin/src/components/admin-route-guard.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthed, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthed) {
      router.replace("/login");
    } else if (!loading && user && user.role !== "admin") {
      router.replace("/login?error=forbidden");
    }
  }, [loading, isAuthed, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthed || (user && user.role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: 修改 layout.tsx 使用 AdminRouteGuard**

```typescript
// web/admin/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClawHost Admin",
  description: "ClawHost Administration Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <TooltipProvider>
            <AdminRouteGuard>
              <AppShell>{children}</AppShell>
            </AdminRouteGuard>
          </TooltipProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 创建登录页面的 layout（排除 Guard）**

```typescript
// web/admin/src/app/login/layout.tsx
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 4: 提交更改**

```bash
git add web/admin/src/components/admin-route-guard.tsx web/admin/src/app/layout.tsx web/admin/src/app/login/layout.tsx
git commit -m "feat(admin): add admin route guard for role-based access"
```

---

### Task 7: 更新 Admin 侧边栏导航

**Files:**
- Modify: `web/admin/src/components/app-sidebar.tsx`

- [ ] **Step 1: 更新导航项**

```typescript
// web/admin/src/components/app-sidebar.tsx
// 修改 navItems 数组

const navItems = [
  { title: "Users", href: "/users", icon: <UsersIcon /> },
  { title: "Agents", href: "/agents", icon: <BotIcon /> },
  { title: "Plans", href: "/subscription/plans", icon: <CreditCardIcon /> },
  { title: "Credit Packs", href: "/subscription/packs", icon: <PackageIcon /> },
];
```

- [ ] **Step 2: 添加缺少的图标导入**

```typescript
// web/admin/src/components/app-sidebar.tsx
// 更新 imports

import {
  UsersIcon,
  BotIcon,
  CreditCardIcon,
  PackageIcon,
  LogOutIcon,
  EllipsisVerticalIcon,
  CircleUserRoundIcon,
} from "lucide-react";
```

- [ ] **Step 3: 更新用户信息显示**

```typescript
// web/admin/src/components/app-sidebar.tsx
// 在 SidebarFooter 中显示实际用户信息

const { user, logout } = useAuth();

// ...

<span className="truncate font-medium">{user?.name || "Admin"}</span>
<span className="truncate text-xs text-foreground/70">
  {user?.email || ""}
</span>
```

- [ ] **Step 4: 提交更改**

```bash
git add web/admin/src/components/app-sidebar.tsx
git commit -m "refactor(admin): update sidebar navigation for new structure"
```

---

### Task 8: 重命名并修改 Agents 页面（只读）

**Files:**
- Rename: `web/admin/src/app/bots/page.tsx` → `web/admin/src/app/agents/page.tsx`

- [ ] **Step 1: 重命名文件**

```bash
mv web/admin/src/app/bots/page.tsx web/admin/src/app/agents/page.tsx
```

- [ ] **Step 2: 移除创建 Agent 功能**

在 `web/admin/src/app/agents/page.tsx` 中：

```typescript
// 删除以下内容:
// - showCreateDialog state
// - createForm state
// - handleCreate function
// - "Create Bot" 按钮
// - Create Bot Dialog

// 修改页面标题:
<h1 className="text-xl md:text-2xl font-bold">Agents</h1>
<p className="text-muted-foreground text-sm">
  View all agents (managed by users in Portal)
</p>
```

- [ ] **Step 3: 移除批量操作按钮（或保留为只读状态查看）**

```typescript
// 移除或注释掉:
// - Upgrade All 按钮
// - Restart All 按钮
// 或者保留但改为只显示状态
```

- [ ] **Step 4: 更新 BotActions 组件**

```typescript
// 移除 Start/Stop/Upgrade/Delete 操作
// 只保留:
// - Copy ID
// - Copy Token (如果有权限)
// - View Details (跳转到 Portal 或显示详情)
```

- [ ] **Step 5: 提交更改**

```bash
git add web/admin/src/app/agents/page.tsx
git rm web/admin/src/app/bots/page.tsx
git commit -m "refactor(admin): rename bots to agents, make read-only"
```

---

### Task 9: 创建用户管理页面

**Files:**
- Create: `web/admin/src/app/users/page.tsx`

- [ ] **Step 1: 创建用户管理页面**

```typescript
// web/admin/src/app/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { listUsers, updateUser, type User } from "@/lib/api";

export default function UsersPage() {
  const { isAuthed } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthed) {
      listUsers()
        .then((res) => setUsers(res.data || []))
        .catch((err) => toast.error(err.message))
        .finally(() => setLoading(false));
    }
  }, [isAuthed]);

  async function handleRoleChange(userId: string, role: string) {
    try {
      await updateUser(userId, { role });
      toast.success("Role updated");
      setUsers((users) =>
        users.map((u) => (u.id === userId ? { ...u, role } : u))
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleStatusChange(userId: string, status: string) {
    try {
      await updateUser(userId, { status });
      toast.success("Status updated");
      setUsers((users) =>
        users.map((u) => (u.id === userId ? { ...u, status } : u))
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!isAuthed) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm">
          Manage user accounts and permissions
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.id, v)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.status}
                      onValueChange={(v) => handleStatusChange(user.id, v)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 api.ts 中添加用户管理 API**

```typescript
// web/admin/src/lib/api.ts
// 添加以下函数:

export async function listUsers() {
  return request<User[]>("/users");
}

export async function updateUser(id: string, data: { role?: string; status?: string }) {
  return request<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 3: 提交更改**

```bash
git add web/admin/src/app/users/page.tsx web/admin/src/lib/api.ts
git commit -m "feat(admin): add users management page"
```

---

### Task 10: 修改 Admin 首页重定向

**Files:**
- Modify: `web/admin/src/app/page.tsx`

- [ ] **Step 1: 修改首页为重定向**

```typescript
// web/admin/src/app/page.tsx
import { redirect } from "next/navigation";

export default function AdminRootPage() {
  redirect("/users");
}
```

- [ ] **Step 2: 提交更改**

```bash
git add web/admin/src/app/page.tsx
git commit -m "refactor(admin): redirect root to users page"
```

---

## Phase 2: Portal 功能完善

### Task 11: 添加 Portal 配置管理 Actions

**Files:**
- Modify: `portal/src/lib/actions.ts`

- [ ] **Step 1: 添加配置管理 Actions**

```typescript
// portal/src/lib/actions.ts
// 添加以下函数:

// --- Config Models ---

export async function listModelProviders(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/models`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list providers" };
  }
  return { providers: data.data };
}

export async function addModelProvider(agentId: string, provider: {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  auth?: string;
  api?: string;
  models?: Array<{ id: string; name?: string }>;
}) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/models`, {
    method: "POST",
    body: JSON.stringify(provider),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to add provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function updateModelProvider(
  agentId: string,
  providerName: string,
  provider: { baseUrl?: string; apiKey?: string; auth?: string; api?: string; models?: Array<{ id: string; name?: string }> }
) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/config/models/${providerName}`,
    {
      method: "PUT",
      body: JSON.stringify(provider),
    }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function deleteModelProvider(agentId: string, providerName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/config/models/${providerName}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete provider" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Config Defaults ---

export async function getAgentDefaults(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/defaults`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to get defaults" };
  }
  return { defaults: data.data };
}

export async function setAgentDefaults(agentId: string, defaults: Record<string, unknown>) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/defaults`, {
    method: "PUT",
    body: JSON.stringify(defaults),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to set defaults" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Raw Config ---

export async function getAgentRawConfig(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/raw`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to get raw config" };
  }
  return { config: data.data };
}

export async function updateAgentRawConfig(agentId: string, config: Record<string, unknown>) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/config/raw`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to update raw config" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Skills ---

export async function listSkills(agentId: string) {
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/skills`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list skills" };
  }
  return { skills: data.data };
}

export async function deleteSkill(agentId: string, skillName: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/skills/${skillName}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to delete skill" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

// --- Devices ---

export async function listDevices(agentId: string, status?: string) {
  const query = status ? `?status=${status}` : "";
  const res = await fetchWithAuth(`/api/v1/agents/${agentId}/devices${query}`);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to list devices" };
  }
  return { devices: data.data?.devices || [] };
}

export async function approveDevice(agentId: string, requestId: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/devices/${requestId}/approve`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to approve device" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

export async function revokeDevice(agentId: string, deviceId: string) {
  const res = await fetchWithAuth(
    `/api/v1/agents/${agentId}/devices/${deviceId}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    return { error: data.message || "Failed to revoke device" };
  }
  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}
```

- [ ] **Step 2: 提交更改**

```bash
git add portal/src/lib/actions.ts
git commit -m "feat(portal): add config/skills/devices actions"
```

---

### Task 12: 创建 Agent 配置页面

**Files:**
- Create: `portal/src/app/(dashboard)/agents/[id]/config/page.tsx`
- Create: `portal/src/components/config-models-panel.tsx`

- [ ] **Step 1: 创建配置页面**

```typescript
// portal/src/app/(dashboard)/agents/[id]/config/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfigModelsPanel } from "@/components/config-models-panel";
import { listModelProviders } from "@/lib/actions";

interface Provider {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string }>;
}

export default function ConfigPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, [agentId]);

  async function loadProviders() {
    setLoading(true);
    const result = await listModelProviders(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setProviders(result.providers || {});
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            {t("agent.config.models")}
          </span>
        </div>
        <div className="glass-panel-content">
          <ConfigModelsPanel
            agentId={agentId}
            providers={providers}
            loading={loading}
            onRefresh={loadProviders}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 Models 面板组件**

```typescript
// portal/src/components/config-models-panel.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  addModelProvider,
  updateModelProvider,
  deleteModelProvider,
} from "@/lib/actions";

interface Provider {
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string }>;
}

interface Props {
  agentId: string;
  providers: Record<string, Provider>;
  loading: boolean;
  onRefresh: () => void;
}

export function ConfigModelsPanel({ agentId, providers, loading, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function openAddDialog() {
    setEditingProvider(null);
    setForm({ name: "", baseUrl: "", apiKey: "" });
    setDialogOpen(true);
  }

  function openEditDialog(name: string, provider: Provider) {
    setEditingProvider(name);
    setForm({
      name,
      baseUrl: provider.baseUrl || "",
      apiKey: "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (editingProvider) {
        const result = await updateModelProvider(agentId, editingProvider, {
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Provider updated");
      } else {
        const result = await addModelProvider(agentId, {
          name: form.name,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Provider added");
      }
      setDialogOpen(false);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete provider "${name}"?`)) return;
    const result = await deleteModelProvider(agentId, name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider deleted");
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(providers).map(([name, provider]) => (
        <div
          key={name}
          className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
        >
          <div>
            <p className="text-sm font-medium text-white">{name}</p>
            {provider.baseUrl && (
              <p className="text-xs text-white/40 font-mono">{provider.baseUrl}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(name, provider)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={() => handleDelete(name)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={openAddDialog}>
        Add Provider
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "Edit Provider" : "Add Provider"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingProvider && (
              <div className="space-y-2">
                <Label>Provider Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="openai, anthropic, etc."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: 提交更改**

```bash
git add portal/src/app/\(dashboard\)/agents/\[id\]/config/page.tsx portal/src/components/config-models-panel.tsx
git commit -m "feat(portal): add agent config page with models panel"
```

---

### Task 13: 创建 Skills 管理页面

**Files:**
- Create: `portal/src/app/(dashboard)/agents/[id]/skills/page.tsx`
- Create: `portal/src/components/skill-list.tsx`

- [ ] **Step 1: 创建 Skills 页面**

```typescript
// portal/src/app/(dashboard)/agents/[id]/skills/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SkillList } from "@/components/skill-list";
import { listSkills } from "@/lib/actions";
import type { AgentStatus } from "@/types";

interface Skill {
  name: string;
}

export default function SkillsPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("stopped");

  useEffect(() => {
    loadSkills();
  }, [agentId]);

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

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            {t("agent.skills.title")}
          </span>
        </div>
        <div className="glass-panel-content">
          <SkillList
            agentId={agentId}
            skills={skills}
            loading={loading}
            agentStatus={agentStatus}
            onRefresh={loadSkills}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 SkillList 组件**

```typescript
// portal/src/components/skill-list.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { deleteSkill } from "@/lib/actions";
import { Trash2, FileCode } from "lucide-react";
import type { AgentStatus } from "@/types";

interface Skill {
  name: string;
}

interface Props {
  agentId: string;
  skills: Skill[];
  loading: boolean;
  agentStatus: AgentStatus;
  onRefresh: () => void;
}

export function SkillList({
  agentId,
  skills,
  loading,
  agentStatus,
  onRefresh,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteSkill(agentId, deleteTarget);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Skill deleted");
      setDeleteTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">Loading...</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-white/50 text-sm">
        No skills configured
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                <FileCode className="w-4 h-4 text-white/50" />
              </div>
              <span className="text-sm font-medium text-white">
                {skill.name}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={() => setDeleteTarget(skill.name)}
              disabled={agentStatus !== "running"}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Skill"
        description={`Are you sure you want to delete "${deleteTarget}"?`}
        loading={deleting}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
```

- [ ] **Step 3: 提交更改**

```bash
git add portal/src/app/\(dashboard\)/agents/\[id\]/skills/page.tsx portal/src/components/skill-list.tsx
git commit -m "feat(portal): add skills management page"
```

---

### Task 14: 创建 Devices 配对页面

**Files:**
- Create: `portal/src/app/(dashboard)/agents/[id]/devices/page.tsx`
- Create: `portal/src/components/device-list.tsx`

- [ ] **Step 1: 创建 Devices 页面**

```typescript
// portal/src/app/(dashboard)/agents/[id]/devices/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DeviceList } from "@/components/device-list";
import { listDevices } from "@/lib/actions";

interface Device {
  request_id?: string;
  device_id: string;
  platform?: string;
  client_mode?: string;
  ip?: string;
  age?: string;
  status: "pending" | "paired" | "revoked";
  connected?: boolean;
}

export default function DevicesPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
    // 每 10 秒刷新一次
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, [agentId]);

  async function loadDevices() {
    const result = await listDevices(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setDevices(result.devices || []);
    }
    setLoading(false);
  }

  const pendingDevices = devices.filter((d) => d.status === "pending");
  const pairedDevices = devices.filter((d) => d.status === "paired");

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            Pending Devices ({pendingDevices.length})
          </span>
        </div>
        <div className="glass-panel-content">
          <DeviceList
            agentId={agentId}
            devices={pendingDevices}
            loading={loading}
            type="pending"
            onRefresh={loadDevices}
          />
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-white text-sm">
            Paired Devices ({pairedDevices.length})
          </span>
        </div>
        <div className="glass-panel-content">
          <DeviceList
            agentId={agentId}
            devices={pairedDevices}
            loading={loading}
            type="paired"
            onRefresh={loadDevices}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 DeviceList 组件**

```typescript
// portal/src/components/device-list.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "./confirm-dialog";
import { approveDevice, revokeDevice } from "@/lib/actions";
import { Check, X, Monitor, Smartphone, Terminal } from "lucide-react";

interface Device {
  request_id?: string;
  device_id: string;
  platform?: string;
  client_mode?: string;
  ip?: string;
  age?: string;
  status: "pending" | "paired" | "revoked";
  connected?: boolean;
}

interface Props {
  agentId: string;
  devices: Device[];
  loading: boolean;
  type: "pending" | "paired";
  onRefresh: () => void;
}

const platformIcons: Record<string, React.ReactNode> = {
  web: <Monitor className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  cli: <Terminal className="w-4 h-4" />,
};

export function DeviceList({
  agentId,
  devices,
  loading,
  type,
  onRefresh,
}: Props) {
  const [actionTarget, setActionTarget] = useState<Device | null>(null);
  const [acting, setActing] = useState(false);

  async function handleApprove() {
    if (!actionTarget?.request_id) return;
    setActing(true);
    const result = await approveDevice(agentId, actionTarget.request_id);
    setActing(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Device approved");
      setActionTarget(null);
      onRefresh();
    }
  }

  async function handleRevoke() {
    if (!actionTarget?.device_id) return;
    setActing(true);
    const result = await revokeDevice(agentId, actionTarget.device_id);
    setActing(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Device revoked");
      setActionTarget(null);
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">Loading...</div>;
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-4 text-white/50 text-sm">
        No {type} devices
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {devices.map((device) => (
          <div
            key={device.request_id || device.device_id}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/50">
                {platformIcons[device.client_mode || ""] || <Monitor className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {device.platform || device.client_mode || "Unknown"}
                </p>
                <p className="text-xs text-white/40">
                  {device.ip && `${device.ip} · `}
                  {device.age || "Just now"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {device.connected && (
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  Connected
                </Badge>
              )}
              {type === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-400 hover:text-green-300"
                  onClick={() => setActionTarget(device)}
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}
              {type === "paired" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setActionTarget(device)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {type === "pending" && (
        <ConfirmDialog
          open={!!actionTarget}
          onOpenChange={() => setActionTarget(null)}
          title="Approve Device"
          description="Allow this device to connect to your agent?"
          loading={acting}
          onConfirm={handleApprove}
          confirmText="Approve"
        />
      )}

      {type === "paired" && (
        <ConfirmDialog
          open={!!actionTarget}
          onOpenChange={() => setActionTarget(null)}
          title="Revoke Device"
          description="This will disconnect the device from your agent."
          loading={acting}
          onConfirm={handleRevoke}
          variant="destructive"
          confirmText="Revoke"
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: 提交更改**

```bash
git add portal/src/app/\(dashboard\)/agents/\[id\]/devices/page.tsx portal/src/components/device-list.tsx
git commit -m "feat(portal): add devices pairing page"
```

---

### Task 15: 更新 Agent 导航 Tab

**Files:**
- Modify: `portal/src/components/agent-detail-header.tsx`

- [ ] **Step 1: 添加新的 Tab 链接**

```typescript
// portal/src/components/agent-detail-header.tsx
// 更新 view tabs 部分

{/* View tabs */}
<div className="flex gap-0 px-5 mt-3">
  <Link
    href={`/agents/${agentId}`}
    className={cn(
      "view-tab",
      !isChatTab && !pathname.includes("/config") && !pathname.includes("/skills") && !pathname.includes("/devices") && "view-tab-active"
    )}
  >
    {t("agent.management")}
  </Link>
  <Link
    href={`/agents/${agentId}/config`}
    className={cn(
      "view-tab",
      pathname.includes("/config") && "view-tab-active"
    )}
  >
    {t("agent.config.title")}
  </Link>
  <Link
    href={`/agents/${agentId}/skills`}
    className={cn(
      "view-tab",
      pathname.includes("/skills") && "view-tab-active"
    )}
  >
    {t("agent.skills.title")}
  </Link>
  <Link
    href={`/agents/${agentId}/devices`}
    className={cn(
      "view-tab",
      pathname.includes("/devices") && "view-tab-active"
    )}
  >
    {t("agent.devices.title")}
  </Link>
  <Link
    href={`/agents/${agentId}/chat`}
    className={cn(
      "view-tab",
      isChatTab && "view-tab-active"
    )}
  >
    {t("agent.chat")}
  </Link>
</div>
```

- [ ] **Step 2: 提交更改**

```bash
git add portal/src/components/agent-detail-header.tsx
git commit -m "feat(portal): add config/skills/devices tabs to agent header"
```

---

### Task 16: 添加 i18n 翻译

**Files:**
- Modify: `portal/src/messages/en.json`
- Modify: `portal/src/messages/zh.json`

- [ ] **Step 1: 添加英文翻译**

```json
// portal/src/messages/en.json
// 在 agent 对象中添加:

{
  "agent": {
    "config": {
      "title": "Config",
      "models": "Model Providers",
      "defaults": "Defaults",
      "raw": "Raw Config"
    },
    "skills": {
      "title": "Skills",
      "delete": "Delete Skill"
    },
    "devices": {
      "title": "Devices",
      "pending": "Pending",
      "paired": "Paired",
      "approve": "Approve",
      "revoke": "Revoke"
    }
  }
}
```

- [ ] **Step 2: 添加中文翻译**

```json
// portal/src/messages/zh.json
// 在 agent 对象中添加:

{
  "agent": {
    "config": {
      "title": "配置",
      "models": "模型提供商",
      "defaults": "默认设置",
      "raw": "原始配置"
    },
    "skills": {
      "title": "技能",
      "delete": "删除技能"
    },
    "devices": {
      "title": "设备",
      "pending": "待配对",
      "paired": "已配对",
      "approve": "批准",
      "revoke": "撤销"
    }
  }
}
```

- [ ] **Step 3: 提交更改**

```bash
git add portal/src/messages/en.json portal/src/messages/zh.json
git commit -m "feat(portal): add i18n for config/skills/devices"
```

---

## Phase 3: 权限验证

### Task 17: 验证 Admin 权限守卫

- [ ] **Step 1: 测试 Admin 登录**

1. 使用普通用户登录 Admin → 应显示 "Admin access required"
2. 使用 admin 用户登录 Admin → 应成功进入后台

- [ ] **Step 2: 测试 API 权限**

1. 未登录用户访问 `/api/v1/admin/*` → 返回 401
2. 普通 user 访问 `/api/v1/admin/*` → 返回 403
3. admin 用户访问 `/api/v1/admin/*` → 返回 200

- [ ] **Step 3: 提交测试确认**

---

### Task 18: 验证 Agent 所有权

- [ ] **Step 1: 测试 Agent 所有权隔离**

1. 用户 A 创建 Agent
2. 用户 B 尝试访问用户 A 的 Agent → 返回 403
3. 用户 A 可以正常操作自己的 Agent

- [ ] **Step 2: 提交测试确认**

---

## Summary

**Phase 1: Admin 后台修复 (Task 1-10)**
- 修复 API 路径
- 添加 JWT 登录
- 实现权限守卫
- 重构页面结构

**Phase 2: Portal 功能完善 (Task 11-16)**
- 配置管理页面
- Skills 管理页面
- Devices 配对页面
- i18n 翻译

**Phase 3: 权限验证 (Task 17-18)**
- Admin 权限测试
- Agent 所有权测试