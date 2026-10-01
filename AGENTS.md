# GreenPlace — AI Agent Instructions

## Project Overview

GreenPlace is a web platform for sustainable living in Metro Cebu. It connects residents with waste management establishments, provides a marketplace for recyclable materials, and fosters a sustainability community.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, React-Leaflet, lucide-react |
| Backend | Node.js, Express.js, CommonJS modules |
| Database | Supabase PostgreSQL (auth, storage, RLS) |
| Payments | PayMongo (test mode), Cash on Pickup |
| Maps | OpenStreetMap, Leaflet, React-Leaflet |

## Architecture

```
React/Vite (client/) → Express.js (server/) → Supabase PostgreSQL
```

Client runs on `http://localhost:5173`, server on `http://localhost:3001`.

## Commands

```bash
# Frontend
cd client && npm run dev      # Start dev server
cd client && npm run lint     # Run oxlint (REQUIRED after edits)
cd client && npm run build    # Production build

# Backend
cd server && npm run dev      # Start with nodemon
```

## Directory Structure

```
├── client/src/
│   ├── components/
│   │   ├── layout/          # MainLayout, DashboardLayout, Navbar, Sidebar
│   │   └── ui/              # Reusable: Button, Input, Modal, Badge, etc.
│   ├── context/             # AuthContext, CartContext
│   ├── lib/                 # api.js (axios instance), utilities
│   ├── pages/               # Page components (PascalCase.jsx)
│   │   ├── admin/           # UserManagement, BusinessManagement
│   │   ├── business/        # BusinessRegistration, BusinessProfileManagement
│   │   └── dashboard/       # ResidentDashboard, BusinessDashboard, AdminDashboard, ListingManagement
│   └── App.jsx              # Route definitions
├── server/src/
│   ├── config/              # supabase.js
│   ├── controllers/         # authController.js, businessController.js, marketplaceController.js, userController.js
│   ├── middleware/          # auth.js (authenticate, optionalAuth), rbac.js (requireRole, requireAdmin, requireBusiness, requireResident)
│   ├── routes/              # auth.js, business.js, marketplace.js, user.js
│   ├── services/            # Business logic helpers
│   └── utils/               # Shared utilities
└── database/
    └── migrations/          # SQL migration files (001_foundation.sql, 002_full_schema.sql, etc.)
```

## Frontend Conventions

### File Naming
- Pages: `PascalCase.jsx` (e.g., `Marketplace.jsx`, `Checkout.jsx`)
- Components: `PascalCase.jsx` (e.g., `Button.jsx`, `Modal.jsx`)
- Context: `PascalCaseContext.jsx` (e.g., `AuthContext.jsx`)
- Utilities: `camelCase.js` (e.g., `api.js`)
- Directories: lowercase (e.g., `pages/`, `components/ui/`)

### Component Pattern
```jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function ComponentName() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get('/endpoint');
      setData(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="animate-pulse">...</div>;

  return ( /* JSX */ );
}
```

### Styling
- **Tailwind only** — no CSS modules, no styled-components
- Custom `primary` color scale (primary-50 through primary-700)
- Responsive: `sm:`, `lg:`, `xl:` breakpoints
- Conditional classes: inline template literals with ternary
- Icons: `lucide-react` exclusively

### State Management
- React Context API (AuthContext, CartContext)
- Local state with `useState`
- No Redux, Zustand, or other state libraries

### Import Order
1. React core (`react`, `react-dom`)
2. React Router (`react-router-dom`)
3. Third-party icons (`lucide-react`)
4. Third-party libs (`react-leaflet`, `axios`)
5. Internal API (`../lib/api`)
6. Context hooks (`../context/AuthContext`)
7. UI components (`../components/ui/`)

## Backend Conventions

### File Naming
- Controllers: `camelCaseController.js` (e.g., `orderController.js`)
- Routes: `camelCase.js` (e.g., `orders.js`)
- Middleware: `camelCase.js` (e.g., `auth.js`)
- All use `.js` extension (CommonJS)

### Module System
- **CommonJS** throughout (`require()` / `module.exports`)
- Controllers export object: `module.exports = { handler1, handler2 }`
- Routes export router: `module.exports = router`

### Controller Pattern
```js
const handler = async (req, res) => {
  try {
    // 1. Extract from req.body / req.params / req.query
    // 2. Validate (if (!field) return res.status(400).json({ error: '...' }))
    // 3. Database operation via supabaseAdmin
    // 4. Return response
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Human-readable message' });
  }
};
```

### Response Format
- Success single: `{ resource: { ... } }`
- Success list: `{ collection: [...], pagination: { page, limit, total, pages } }`
- Success action: `{ message: 'Human-readable message' }`
- Error: `{ error: 'Human-readable message' }`

### HTTP Status Codes
- `200` success, `201` created
- `400` validation, `401` auth, `403` forbidden, `404` not found
- `500` server error

### Database Access
- Use `supabaseAdmin` (service role, bypasses RLS)
- Query pattern: `supabaseAdmin.from('table').select().eq().single()`
- Pagination: `.range(offset, offset + limit - 1)` with `{ count: 'exact' }`

### Middleware Available
- `authenticate` — Requires Bearer token, loads `req.user`
- `optionalAuth` — Same but passes through if no token
- `requireAdmin` — Admin only
- `requireBusiness` — Business + admin
- `requireResident` — Resident + admin

### Naming Convention
- Request bodies: camelCase (e.g., `firstName`)
- Database columns: snake_case (e.g., `first_name`)
- Controllers must map between the two

## Database Conventions

### Migration Files
- Three-digit prefix: `001_foundation.sql`, `002_full_schema.sql`
- snake_case descriptive name after prefix
- Sequential numbered SQL scripts

### SQL Style
- Keywords: UPPERCASE (`CREATE TABLE`, `NOT NULL`)
- Identifiers: snake_case (`first_name`, `created_at`)
- UUID primary keys with `uuid_generate_v4()`
- Timestamps: `created_at` and `updated_at` with `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- Auto-update triggers on tables with `updated_at`

### RLS
- Enabled on every table
- Policies use descriptive English strings
- Public read: `USING (TRUE)`
- Owner access: `USING (owner_id = auth.uid())`
- Admin bypass: `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))`

## Workflow

### After Every Code Change
1. Run `cd client && npm run lint` (frontend)
2. Fix any errors reported
3. Verify the build works: `cd client && npm run build`

### Starting a New Feature
1. Use Plan mode to analyze and plan
2. Switch to Build mode to implement
3. Create files following conventions above
4. Run lint after each file
5. Test the feature end-to-end

### When Stuck
- Use `@explore` to search the codebase
- Ask clarifying questions
- Check existing patterns in similar files

## Common Patterns

### Creating a New Page
1. Create `client/src/pages/YourPage.jsx`
2. Add route in `App.jsx`
3. Use `MainLayout` (public) or `DashboardLayout` (authenticated)
4. Wrap with `ProtectedRoute` if auth required

### Creating a New API Endpoint
1. Add handler in `server/src/controllers/yourController.js`
2. Add route in `server/src/routes/your.js`
3. Register route in `server/src/index.js`

### Creating a New Database Table
1. Create migration `database/migrations/XXX_description.sql`
2. Add enum types, table, indexes, RLS policies
3. Add `schema_version` insert

## Current Phase Status

- Phase 1-8: Complete (Auth, UI, Users, Business, Marketplace)
- Phase 9: Orders & Payments
- Phase 10: Refunds, PayMongo Test Mode, Drop-offs
- Phase 11: Receipts (Order + Drop-off, print/PDF with iframe)
- Phase 12+: Forum, Messaging, Notifications
- Phase 16: Reviews (ratings, per-star aggregation, duplicate prevention, business replies)
- Phase 16+: Product reviews (listing_id, separate listing ratings, seller visibility/replies, per-item review on completed orders)

## Receipt Pattern

Receipts use a **dual-render** approach:
- **On-screen**: Tailwind CSS classes for layout
- **Print**: Hidden iframe with standalone HTML built from data using `PRINT_STYLES` classes

Key files:
- `client/src/pages/Receipt.jsx` — Order receipt at `/orders/:id/receipt`
- `client/src/pages/DropOffReceipt.jsx` — Drop-off receipt at `/drop-offs/:id/receipt`

Print filename is set via iframe `<title>` (e.g., `GreenPlace-Receipt-GP-xxx.pdf`).
