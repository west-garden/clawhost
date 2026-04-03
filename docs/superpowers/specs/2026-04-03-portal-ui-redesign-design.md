# Portal UI Redesign: Unified shadcn Style

**Date**: 2026-04-03
**Status**: Approved

## Overview

Redesign ClawHost Portal from Glassmorphism style to flat shadcn style, unified with Admin backend. Replace hardcoded colors with semantic CSS variables.

## Current State

### Portal (`portal/src/app/globals.css`)
- ~800 lines of custom Glass CSS
- Glass effects: blur, gradients, glow borders
- Hardcoded colors in 11 components: `text-white`, `bg-white/10`, `border-white/10`
- Light/Dark theme with custom CSS variables
- Coral (#e63946) and Cyan (#0d9488) brand colors

### Admin (`web/admin/src/app/globals.css`)
- ~130 lines, standard shadcn style
- OKLCH color variables
- No hardcoded color issues
- Clean, flat design

## Target State

Portal adopts the same shadcn style as Admin:
- OKLCH semantic color variables
- Remove glassmorphism effects
- Replace all hardcoded `text-white` with `text-foreground`
- Consistent light/dark theme handling

## Implementation Scope

### Phase 1: CSS Variables & Base Styles

Rewrite `portal/src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: 0.625rem;
}

:root {
  --background: oklch(0.99 0.005 30);      /* Warm white */
  --foreground: oklch(0.145 0.01 30);      /* Warm dark */
  --card: oklch(0.99 0.005 30);
  --card-foreground: oklch(0.145 0.01 30);
  --popover: oklch(0.99 0.005 30);
  --popover-foreground: oklch(0.145 0.01 30);
  --primary: oklch(0.55 0.22 25);          /* Coral brand color */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0.005 30);
  --secondary-foreground: oklch(0.205 0.01 30);
  --muted: oklch(0.97 0.005 30);
  --muted-foreground: oklch(0.556 0.01 30);
  --accent: oklch(0.55 0.15 180);          /* Teal accent */
  --accent-foreground: oklch(0.145 0.01 30);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0.005 30);
  --input: oklch(0.922 0.005 30);
  --ring: oklch(0.55 0.22 25);
}

.dark {
  --background: oklch(0.145 0.01 250);    /* Cool dark */
  --foreground: oklch(0.985 0.005 250);
  --card: oklch(0.205 0.01 250);
  --card-foreground: oklch(0.985 0.005 250);
  --popover: oklch(0.205 0.01 250);
  --popover-foreground: oklch(0.985 0.005 250);
  --primary: oklch(0.65 0.22 25);          /* Coral in dark */
  --primary-foreground: oklch(0.145 0.01 250);
  --secondary: oklch(0.269 0.01 250);
  --secondary-foreground: oklch(0.985 0.005 250);
  --muted: oklch(0.269 0.01 250);
  --muted-foreground: oklch(0.708 0.01 250);
  --accent: oklch(0.65 0.15 180);          /* Teal in dark */
  --accent-foreground: oklch(0.985 0.005 250);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.65 0.22 25);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Keep minimal custom components:
- `.glass-btn` → Keep with coral gradient (brand identity)
- `.glass-btn-secondary` → Simplify to use semantic vars
- `.glass-input` → Simplify, use semantic vars
- `.glass-label` → Keep, use semantic vars
- `.status-dot-*` → Keep, use semantic colors
- `.agent-sidebar` → Simplify, remove glass effects
- `.pricing-card` → Simplify, flat style

Remove:
- `.glass-bg::before` (animated gradient background)
- `.glass-card`, `.glass-panel`, `.glass-panel-header`, `.glass-panel-content`
- `.glass-badge-*` (use shadcn Badge instead)
- `.glass-nav`, `.glass-nav-item`
- `.glass-stat`, `.glass-header`, `.glass-link`, `.glass-title`
- `.glass-glow`, `.glass-divider`, `.glass-orb-*`

### Phase 2: Component Fixes

Replace hardcoded colors in 11 files:

| File | Changes |
|------|---------|
| `subscription-page.tsx` | `text-white` → `text-foreground`, `text-white/40` → `text-muted-foreground` |
| `agent-sidebar.tsx` | Already fixed partially, verify all instances |
| `agent-detail-header.tsx` | Already fixed partially, verify all instances |
| `chat-panel.tsx` | `text-white` → `text-foreground` |
| `mobile-header.tsx` | `text-white` → `text-foreground` |
| `config-models-panel.tsx` | `text-white` → `text-foreground` |
| `skill-list.tsx` | `text-white` → `text-foreground` |
| `device-list.tsx` | `text-white` → `text-foreground` |
| `config/page.tsx` | `text-white` → `text-foreground` |
| `skills/page.tsx` | `text-white` → `text-foreground` |
| `devices/page.tsx` | `text-white` → `text-foreground` |

### Phase 3: Layout Components

Simplify layout styles:
- `agent-sidebar.tsx`: Remove glass background, use `bg-card` or `bg-muted`
- `agent-detail-header.tsx`: Remove glass background
- `management-panel.tsx`: Use shadcn Card components
- `channel-list.tsx`: Simplify to flat style

## Design Decisions

1. **Keep coral gradient on primary buttons** - Brand identity, but simplify implementation
2. **Remove animated background** - Too distracting, not needed for management UI
3. **Use OKLCH colors** - Perceptually uniform, easier to maintain
4. **Tint neutrals toward brand hue** - Warm tint (30 hue) for light, cool tint (250 hue) for dark
5. **Keep status colors** - Running (green), Stopped (red), Starting (yellow), Created (gray)

## Success Criteria

- All text visible in both light and dark modes
- No hardcoded `text-white` or `bg-white/` in components
- Portal and Admin have consistent visual style
- All existing functionality preserved