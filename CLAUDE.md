# CLAUDE.md — Family Task App

This document describes the codebase structure, development workflows, and conventions for AI assistants working on this project.

---

## Project Overview

**家族タスクアプリ** is a mobile-first web application for sharing and managing tasks within a household (family/couple). It is built with Next.js 16, React 19, Supabase (PostgreSQL + Realtime + Auth), and Tailwind CSS v4.

The UI language is **Japanese**. All user-visible strings should remain in Japanese.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Framer Motion, dnd-kit |
| Icons | lucide-react |
| Backend / DB | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Language | TypeScript 5 (strict mode) |
| Linting | ESLint 9 with `eslint-config-next` (Core Web Vitals + TypeScript) |
| Package manager | npm |

---

## Repository Structure

```
family-task-app/
├── src/
│   ├── app/                        # Next.js App Router pages & routes
│   │   ├── layout.tsx              # Root layout (fonts, metadata, PWA config)
│   │   ├── page.tsx                # Main task list page (home)
│   │   ├── globals.css             # Global CSS + Tailwind import + CSS vars
│   │   ├── login/page.tsx          # Login page
│   │   ├── signup/page.tsx         # Sign-up page
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── settings/page.tsx       # Settings page (profile, household, categories)
│   │   ├── household/
│   │   │   ├── new/page.tsx        # Create new household
│   │   │   └── join/page.tsx       # Join household via invite code
│   │   └── auth/
│   │       └── callback/route.ts   # Supabase OAuth/magic-link callback handler
│   ├── components/
│   │   ├── auth/                   # Auth forms (login, signup, forgot/reset password)
│   │   ├── category/               # CategoryTabs, CategoryManager
│   │   ├── household/              # CreateForm, JoinForm
│   │   ├── settings/               # ProfileEditor, HouseholdSettings, CategorySettings
│   │   ├── task/                   # TaskList, TaskItem, TaskCreateSheet, TaskDetailModal
│   │   └── ui/                     # Reusable primitives: Button, Input, BottomSheet, Modal, Fab
│   ├── hooks/
│   │   ├── use-tasks.ts            # CRUD + reorder for tasks (client-side)
│   │   ├── use-categories.ts       # CRUD for categories (client-side)
│   │   └── use-realtime-tasks.ts   # Supabase Realtime subscription for tasks
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts           # Browser Supabase client (createBrowserClient)
│   │       ├── server.ts           # Server Supabase client (createServerClient + cookies)
│   │       └── middleware.ts       # Session refresh + auth redirect logic
│   ├── types/
│   │   ├── database.ts             # Auto-generated Supabase DB types (source of truth)
│   │   └── index.ts                # Derived convenience types (Task, Profile, etc.)
│   └── proxy.ts                    # Next.js middleware entry point (re-exports updateSession)
├── supabase/
│   ├── config.toml                 # Supabase local dev configuration
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema, RLS policies, triggers, functions
├── public/                         # Static assets
├── next.config.ts                  # Next.js configuration (currently minimal)
├── tsconfig.json                   # TypeScript configuration
├── eslint.config.mjs               # ESLint flat config
├── postcss.config.mjs              # PostCSS config (Tailwind v4)
└── package.json
```

---

## Database Schema

All data is scoped to a **household** (group of users).

### Tables

| Table | Purpose |
|---|---|
| `households` | A family/couple group. Has an optional 24-hour invite code. |
| `profiles` | One per `auth.users` row. Linked to a `household_id`. Has `nickname` and `avatar_url`. |
| `categories` | Household-scoped task categories with `name`, `color`, `icon`, `sort_order`. |
| `tasks` | Core entity: `title`, `memo`, `url`, `due_date`, `is_done`, `sort_order`, `created_by`, `completed_at`. |
| `task_assignees` | Many-to-many join between `tasks` and `profiles`. |
| `task_images` | Storage paths for images attached to tasks. |

### Key Database Functions (callable via `supabase.rpc()`)

- `create_default_categories(p_household_id)` — inserts default categories when a household is created.
- `generate_invite_code(p_household_id)` — generates a 6-character uppercase invite code valid for 24 hours.
- `get_my_household_id()` — security-definer helper used in RLS policies to avoid infinite recursion.
- `handle_new_user()` — trigger function: auto-creates a `profiles` row on `auth.users` insert.
- `handle_updated_at()` — trigger function: keeps `updated_at` current on row updates.

### RLS Summary

Row Level Security is enabled on all tables. Access is scoped using `get_my_household_id()`:
- Users can only read/write data belonging to their own household.
- The `households` table has a broad `select` policy (read-all) to support joining via invite code.

### Realtime

`tasks` and `categories` tables are published to `supabase_realtime`. The `useRealtimeTasks` hook subscribes to INSERT/UPDATE/DELETE events filtered by `household_id`.

---

## Authentication Flow

1. User registers via `/signup` → Supabase creates `auth.users` row → trigger auto-creates `profiles` row.
2. User logs in via `/login` → session stored in cookies via `@supabase/ssr`.
3. Middleware (`src/proxy.ts` → `src/lib/supabase/middleware.ts`) refreshes sessions and enforces redirects:
   - Unauthenticated users → `/login`
   - Authenticated users on auth pages → `/`
4. Public paths exempt from redirect: `/login`, `/signup`, `/auth/callback`, `/forgot-password`.
5. OAuth/magic-link callback handled by `src/app/auth/callback/route.ts` (exchanges code for session).

After login, `src/app/page.tsx` checks:
- If user has no profile → redirect to `/login`
- If profile has no `household_id` → redirect to `/household/new`

---

## Supabase Client Usage

**Always use the correct client for the rendering context:**

| Context | Import |
|---|---|
| Client Components (`"use client"`) | `import { createClient } from "@/lib/supabase/client"` |
| Server Components / Route Handlers | `import { createClient } from "@/lib/supabase/server"` |
| Middleware | `createServerClient` directly in `src/lib/supabase/middleware.ts` |

Do **not** use `createBrowserClient` in Server Components or vice versa.

---

## Custom Hooks

### `useTasks(householdId, categoryId?)`
Manages task state with full CRUD and optimistic reordering:
- `tasks` — current task array
- `setTasks` — raw state setter (used by `useRealtimeTasks`)
- `addTask(task)`, `updateTask(id, updates)`, `deleteTask(id)`, `toggleTask(id)`, `reorderTasks(orderedIds)`
- Automatically sets `completed_at` when `is_done` transitions.
- Tasks are ordered: `is_done ASC`, `sort_order ASC`, `created_at DESC`.

### `useCategories(householdId)`
Manages category state with CRUD:
- `categories`, `addCategory(name, color)`, `updateCategory(id, updates)`, `deleteCategory(id)`

### `useRealtimeTasks(householdId, setTasks)`
Opens a Supabase Realtime channel scoped to the household. Handles INSERT, UPDATE, DELETE events and merges them into local task state. Deduplicates inserts to avoid conflicts with optimistic updates.

---

## Component Conventions

### UI Primitives (`src/components/ui/`)

- **`BottomSheet`** — animated slide-up sheet (Framer Motion). Closes on backdrop tap or drag-down (>100px). Locks `document.body` scroll while open.
- **`Modal`** — centered overlay modal.
- **`Fab`** — floating action button (fixed bottom-right) for creating tasks.
- **`Button`** — standard button with `size` prop (`sm` | default).
- **`Input`** — styled input component.

### Task Components (`src/components/task/`)

- **`TaskList`** — renders active tasks (drag-and-drop sortable via dnd-kit) and completed tasks. Handles bulk selection mode (long-press activates), bulk complete/delete, and confetti on all-tasks-done.
- **`TaskItem`** — individual task card. Supports swipe-left-to-delete (Framer Motion pan gesture), drag handle (dnd-kit), long-press for selection mode.
- **`TaskCreateSheet`** — bottom sheet form for creating tasks. Has quick-date buttons (today/tomorrow).
- **`TaskDetailModal`** — modal for editing task details (title, memo, URL, due date, category, assignees).

### All components use `"use client"` directive

This project is entirely client-rendered (no RSC data fetching). Server components are only used for the auth callback route handler.

---

## Styling Conventions

- **Tailwind CSS v4** — imported via `@import "tailwindcss"` in `globals.css` (not `@tailwind` directives).
- **CSS variables** defined in `:root` in `globals.css`: `--primary` (#6366f1 indigo), `--primary-light`, `--primary-dark`, `--background`, `--foreground`. Referenced via `@theme inline` block.
- **Color palette**: Indigo-600 (`#6366f1`) is the primary brand color (buttons, focus rings, active states).
- **`min-h-dvh`** is used instead of `min-h-screen` for mobile-safe viewport height.
- **`no-scrollbar`** utility class (defined in globals.css) hides scrollbars for the category tab strip.
- Category colors are applied inline via `style` prop (dynamic hex colors from DB).

---

## Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`). Always use `@/` imports rather than relative paths.

```ts
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types";
```

---

## Available Scripts

```bash
npm run dev      # Start Next.js development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Local Development Setup

### Prerequisites
- Docker Desktop (required for Supabase local)
- Node.js 20+
- npm

### First-time setup

```bash
npm install

# Start Docker Desktop (via GUI), then:
npx supabase start

# Copy anon key from supabase start output to .env.local:
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>

npx supabase db reset   # Apply migrations + seed data

npm run dev
```

### Daily workflow

```bash
npx supabase start   # Start Supabase (Docker must be running)
npm run dev          # Start dev server
# ... develop ...
npx supabase stop    # Stop Supabase when done
```

### Supabase local services

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio (DB admin) | http://127.0.0.1:54323 |
| Inbucket (email testing) | http://127.0.0.1:54324 |
| DB (direct) | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

### Test account (local only)

After `npx supabase db reset`, seed data is loaded. Use:
- Email: `test@example.com`
- Password: `password`

### Environment Variables

`.env.local` is gitignored. Required variables:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from npx supabase status>
```

---

## Database Migrations

Migration files live in `supabase/migrations/`. The single migration `001_initial_schema.sql` defines the full schema.

```bash
npx supabase db reset          # Reset DB and re-run all migrations + seed
npx supabase migration new <name>   # Create a new migration file
npx supabase db push           # Push migrations to remote Supabase project
```

When modifying the DB schema:
1. Create a new migration file via `npx supabase migration new <name>`.
2. Write SQL in the generated file.
3. Run `npx supabase db reset` locally to apply.
4. Update `src/types/database.ts` to reflect schema changes (can be regenerated with `npx supabase gen types typescript --local > src/types/database.ts`).

---

## Type System

`src/types/database.ts` — the **source of truth** for all DB types. This file mirrors the Supabase schema exactly (Row, Insert, Update, Relationships for each table, plus Functions).

`src/types/index.ts` — exports convenience aliases and composite types:
- `Task`, `Profile`, `Category`, `Household`, `TaskAssignee`, `TaskImage` — aliases for `Row` types.
- `TaskWithAssignees` — `Task & { assignees: Profile[]; category: Category | null }`.
- `HouseholdMember` — alias for `Profile`.

Always import types from `@/types` in components and hooks, not from `@/types/database` directly.

---

## Key Patterns & Conventions

### Optimistic updates
`useTasks` and `useCategories` apply optimistic state updates immediately before awaiting the Supabase call, for a snappy UI. `reorderTasks` is fully optimistic.

### Realtime deduplication
`useRealtimeTasks` deduplicates INSERT events: if a task with the same `id` already exists in local state (from an optimistic insert), the realtime event is ignored.

### Error handling
Supabase calls return `{ data, error }`. Components generally ignore errors silently in the current implementation — errors are not displayed to users. When adding new features, follow this existing pattern unless explicitly improving error handling.

### No tests
There are currently no automated tests in this project. ESLint is the only automated code quality check.

### PWA
The app is configured as a PWA (`manifest.json`, `appleWebApp` metadata). The theme color is `#6366f1`. `userScalable: false` prevents pinch-zoom.

### Japanese strings
All UI text is in Japanese. Do not change language. New UI text must also be in Japanese.

### `"use client"` directive
All components and hooks require `"use client"` since they use browser APIs or React hooks. Only `src/app/auth/callback/route.ts` and `src/lib/supabase/server.ts` run server-side.
