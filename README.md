# SwarnaVyapar Admin Dashboard

> Super Admin Control Panel for SwarnaVyapar Platform

## Overview

Enterprise-grade admin dashboard for managing the SwarnaVyapar multi-tenant jewellery SaaS platform. Built with Next.js 16, TypeScript, and Supabase.

## Features

### Core Capabilities

- 🔐 **Super Admin Authentication** - MFA-enabled secure access
- 🏪 **Shop Management** - Suspend, monitor, and control all shops
- 👥 **User Control** - Manage accounts, permissions, and access
- 📊 **Limit Overrides** - Custom quotas per shop
- 🎛️ **Feature Flags** - Toggle features without deployment
- 💓 **System Health** - Real-time monitoring dashboard
- ⚡ **Bulk Operations** - Mass updates and data management
- 📈 **Analytics** - Platform KPIs and business insights
- 🔒 **Security** - IP whitelist, audit logs, rate limiting
- 📢 **Announcements** - Platform-wide communications

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript 5
- **Database**: Supabase (PostgreSQL)
- **UI**: Tailwind CSS + Radix UI
- **State**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Access to SwarnaVyapar Supabase project

### Installation

\`\`\`bash

# Install dependencies

npm install

# Copy environment file

cp .env.example .env.local

# Configure environment variables

# Add your Supabase credentials

# Run database migrations

npm run db:migrate

# Start development server

npm run dev
\`\`\`

The admin dashboard will be available at http://localhost:9003

### First Super Admin Setup

\`\`\`sql
-- Run this in Supabase SQL Editor after creating your user account
INSERT INTO super_admins (user_id, name, email, permissions, is_active)
VALUES (
'YOUR_USER_UUID',
'Super Admin',
'admin@swarnavyapar.in',
'{
"manage_shops": true,
"manage_users": true,
"manage_limits": true,
"manage_features": true,
"view_analytics": true,
"system_settings": true
}'::jsonb,
true
);
\`\`\`

## Project Structure

\`\`\`
swarnavyapar-admin/
├── src/
│ ├── app/ # Next.js App Router
│ │ ├── (auth)/ # Authentication pages
│ │ ├── (dashboard)/ # Admin dashboard pages
│ │ └── api/ # API routes
│ ├── components/ # Shared UI components
│ │ ├── ui/ # Base UI primitives
│ │ ├── tables/ # Data tables
│ │ └── charts/ # Chart components
│ ├── lib/ # Utilities
│ │ ├── supabase/ # Supabase client
│ │ ├── utils.ts # Helper functions
│ │ └── constants.ts # App constants
│ ├── services/ # Business logic
│ │ ├── admin-auth.ts # Admin authentication
│ │ ├── shop-management.ts # Shop operations
│ │ ├── user-management.ts # User operations
│ │ └── analytics.ts # Analytics service
│ └── types/ # TypeScript types
├── public/ # Static assets
├── migrations/ # Database migrations
└── scripts/ # Utility scripts
\`\`\`

## Development

\`\`\`bash

# Development server (port 9003)

npm run dev

# Type checking

npm run typecheck

# Linting

npm run lint

# Production build

npm run build

# Start production server

npm start
\`\`\`

## Security

### Authentication

- MFA required for all super admins
- IP whitelist enforcement
- Session timeout after 30 minutes inactivity

### Authorization

- Granular permission system
- Role-based access control
- Audit logging for all actions

### Data Protection

- All admin actions logged
- Destructive actions require confirmation
- Automatic session invalidation

## Key Routes

- `/` - Dashboard overview
- `/shops` - Shop management
- `/users` - User management
- `/limits` - Quota controls
- `/features` - Feature flags
- `/health` - System monitoring
- `/analytics` - Platform analytics
- `/audit` - Audit logs
- `/settings` - Admin settings

## Testing

\`\`\`bash

# Run tests (when implemented)

npm test

# E2E tests

npm run test:e2e
\`\`\`

## Deployment

### Vercel (Recommended)

\`\`\`bash

# Install Vercel CLI

npm i -g vercel

# Deploy

vercel

# Production deployment

vercel --prod
\`\`\`

### Environment Variables (Production)

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
ADMIN_IP_WHITELIST=your_office_ips
\`\`\`

## Monitoring

- System health dashboard
- Error tracking (configure Sentry)
- Performance monitoring
- Audit log review

## Support

For issues or questions:

1. Check documentation in `/docs`
2. Review audit logs
3. Contact tech lead

## License

Proprietary - SwarnaVyapar Internal Use Only

---

Built with ❤️ for SwarnaVyapar Platform Management
