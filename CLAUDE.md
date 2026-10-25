# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (run from repo root or cd client/)
cd client && npm run dev        # Vite dev server on :5173
cd client && npm run lint       # oxlint — run after every frontend edit
cd client && npm run build      # Production build

# Backend (run from repo root or cd server/)
cd server && npm run dev        # nodemon on :3001
```

No test runner is configured. There are no test files outside `node_modules`.

## Architecture

```
React/Vite (client/) → Express.js (server/) → Supabase PostgreSQL
```

The server is a thin HTTP layer — it has **no ORM and no business-logic service layer**. All data access goes through the Supabase JS client directly inside controllers. `AGENTS.md` documents full conventions for controllers, routes, migrations, and component patterns.

## Role System (Non-Obvious)

Three roles exist: `resident`, `business`, `admin`. The model is **layered** — converting to `business` does not remove resident capabilities (shopping, checkout, drop-offs remain). This is enforced in `server/src/middleware/rbac.js`:

- `requireResident` — allows `resident`, `business`, `admin`
- `requireBusiness` — allows `business`, `admin`
- `requireAdmin` — allows `admin` only
- `requireBusinessOwner` — same as `requireResident`; ownership is enforced in controllers via `owner_id` checks

Role changes go through admin approval. Migration `026_role_protection.sql` blocks users from self-modifying their own role in the DB.

## Auth Flow

Supabase JWT tokens are stored in `localStorage` (`access_token`, `refresh_token`). The server validates tokens on every request in `server/src/middleware/auth.js` by calling `supabase.auth.getUser(token)`, then fetches the profile from the `profiles` table and attaches it to `req.user.profile`.

Two Supabase clients exist in `server/src/config/supabase.js`:
- `supabase` — anon key, used for auth operations
- `supabaseAdmin` — service role key, bypasses RLS; **use this for all data reads/writes in controllers**

Suspended accounts (`profiles.is_active = false`) are allowed through on GET/HEAD/OPTIONS with `req.user.suspended = true`. Non-safe methods return `403` with `code: 'ACCOUNT_SUSPENDED'`. The client-side axios interceptor in `client/src/lib/api.js` catches this and redirects to `/suspended`.

## Client Routing

`App.jsx` uses `SmartLayout` for public pages: authenticated users get `DashboardLayout` (sidebar), unauthenticated users get `MainLayout` (navbar). Dashboard routes wrap `DashboardLayout` in `ProtectedRoute`. The `/dashboard` route renders `RoleDashboard`, which re-fetches the profile on mount to pick up role changes without requiring re-login.

## Key Patterns

**Dual-render receipts** (`Receipt.jsx`, `DropOffReceipt.jsx`): on-screen uses Tailwind classes; printing uses a hidden iframe injected with standalone HTML built from `PRINT_STYLES` constants. Print filename is set via iframe `<title>`.

**Listing status flow**: listings start as `draft`, transition to `pending` on publish, then require admin approval (`active`/`rejected`). Admins can also mark listings as `featured`.

**Resident → Business conversion**: applying for a business creates a `businesses` row with `status='pending'` while `profiles.role` stays `resident`. `approveBusiness` in `businessController.js` flips the role to `business` and syncs Supabase auth metadata.

**Navigation config**: `client/src/components/layout/navConfig.jsx` drives both `Sidebar` and `MobileMenu`. Edit this file to add or reorder nav items — do not hardcode nav links in layout components.
