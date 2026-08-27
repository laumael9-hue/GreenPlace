# GreenPlace

A web-based digital platform designed to promote sustainable living, proper waste segregation, recycling, composting, waste-management establishment discovery, recyclable material exchange, marketplace transactions, and community engagement in Metro Cebu.

## Problem

Metro Cebu faces significant waste management challenges. Residents struggle to find proper waste disposal facilities, recycling centers are not easily discoverable, and there's no centralized platform for recyclable material exchange or community engagement around sustainability.

## Solution

GreenPlace connects Metro Cebu residents with waste management establishments, provides a marketplace for recyclable materials and eco-friendly products, and fosters a community dedicated to sustainable living practices.

## Objectives

- Enable residents to find and connect with waste management establishments
- Provide a marketplace for recyclable materials and sustainable products
- Track recycling drop-offs and environmental impact
- Build a community forum for sustainability discussions
- Facilitate secure transactions between residents and businesses

## User Roles

1. **Resident** - Browse establishments, use marketplace, track drop-offs, participate in community
2. **Business/Waste Management Establishment** - Manage profile, listings, orders, drop-offs, analytics
3. **Administrator** - Manage users, businesses, moderate content, view reports

## Features

### Resident Features
- Authentication (register, login, logout, password reset)
- Profile management
- Business discovery with map and filters
- Marketplace (browse, cart, checkout, orders)
- Payments (Cash on Pickup, PayMongo test mode)
- Drop-off history tracking
- Community forum
- Messaging with businesses
- Notifications
- Reviews and ratings

### Business Features
- Registration with document upload
- Profile management (hours, materials, prices)
- Marketplace listing management
- Order processing
- Drop-off processing
- Community forum
- Analytics dashboard
- Messaging with residents

### Admin Features
- User management
- Business approval/rejection/suspension
- Marketplace moderation
- Forum moderation
- Reports and CSV export
- System settings

## Architecture

```
React/Vite (Frontend)
    ↓
Express.js (Backend API)
    ↓
Supabase PostgreSQL (Database & Auth & Storage)
```

Integrations:
- OpenStreetMap + Leaflet + React-Leaflet (Maps)
- PayMongo Test Mode (Payments)

## Technology Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Axios
- React Router
- React-Leaflet

### Backend
- Node.js
- Express.js
- Supabase Client

### Database & Auth
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage

### Maps
- OpenStreetMap
- Leaflet
- React-Leaflet

### Payments
- PayMongo Test Mode
- Cash on Pickup

## Setup

### Prerequisites
- Node.js 18+
- npm
- Supabase account (free tier)
- PayMongo account (test mode)

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Database Setup

1. Create a Supabase project
2. Run the SQL migrations in `database/migrations/`
3. Configure Row Level Security policies

### Frontend

```bash
cd client
npm install
npm run dev
```

Runs on http://localhost:5173

### Backend

```bash
cd server
npm install
npm run dev
```

Runs on http://localhost:3001

## Supabase Setup

1. Create a new Supabase project
2. Go to Settings > API to get your keys
3. Enable Email/Password auth in Authentication > Providers
4. Create storage buckets: `profile-images`, `business-documents`, `product-images`
5. Run migrations from `database/migrations/`

## PayMongo Test Setup

1. Create a PayMongo account
2. Go to Developers > API Keys
3. Use TEST keys only (pk_test_..., sk_test_...)
4. Configure webhook URL: `https://your-backend-url/api/payments/webhook`

## Map Setup

Uses OpenStreetMap with Leaflet - no API key required.

## Running Locally

1. Start the backend: `cd server && npm run dev`
2. Start the frontend: `cd client && npm run dev`
3. Visit http://localhost:5173

## Testing

```bash
# Frontend
cd client && npm run test

# Backend
cd server && npm run test
```

## Deployment

### Frontend (Free Tier)
- Vercel
- Netlify
- GitHub Pages

### Backend (Free Tier)
- Render
- Railway
- Fly.io

### Database
- Supabase Free Tier

## Security

- Supabase Row Level Security (RLS)
- Server-side authorization
- Input validation
- Secure file uploads
- Environment variable protection
- CORS configuration
- Helmet.js security headers

## Free-Tier Limitations

- Supabase: 500MB database, 1GB storage, 50MB file uploads
- PayMongo: Test mode only, no real transactions
- Hosting: Platform-specific limits
- Maps: OpenStreetMap rate limits

## Demo Instructions

1. Register as a resident or business
2. Business accounts require admin approval
3. Browse establishments on the map
4. Use marketplace with test payments
5. Participate in community forum
6. Track drop-offs and view receipts

## License

Capstone Project - Educational Use