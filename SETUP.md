# 🚀 SWARNAVYAPAR ADMIN - QUICK START GUIDE

## Step 1: Database Migration

Run the admin infrastructure migration in Supabase SQL Editor:

```bash
# File: migrations/001_admin_infrastructure.sql
```

This creates:

- ✅ super_admins table with permissions
- ✅ super_admin_audit_log for action tracking
- ✅ shop_limit_overrides for custom quotas
- ✅ feature_flags with rollout control
- ✅ shop_feature_overrides per shop
- ✅ platform_announcements
- ✅ system_health_snapshots
- ✅ RLS policies for security
- ✅ Helper functions (is_super_admin, has_admin_permission, etc.)

## Step 2: Create First Super Admin

After migration, create your first super admin account:

### 2a. Create Supabase Auth User

Go to Supabase Dashboard → Authentication → Users → Add User

- Email: admin@yourdomain.com
- Password: (strong password)
- Auto Confirm User: ✅

Copy the user ID from the users table.

### 2b. Make Them Super Admin

Run this SQL (replace `your-user-id`):

```sql
INSERT INTO super_admins (
  user_id,
  name,
  email,
  permissions,
  is_active
) VALUES (
  'your-user-id-here',
  'Super Admin',
  'admin@yourdomain.com',
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
```

## Step 3: Environment Setup

```bash
# Copy environment template
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:9003
```

Get Supabase credentials from: Supabase Dashboard → Settings → API

## Step 4: Install & Run

```bash
# Install dependencies
npm install

# Run development server (port 9003)
npm run dev
```

Visit: http://localhost:9003

## Step 5: Login

1. Navigate to http://localhost:9003/login
2. Enter super admin credentials
3. You'll be redirected to /dashboard

## 🎯 What You Can Do Now

### Shop Management (/shops)

- View all shops with health scores
- Suspend/unsuspend shops with audit trail
- View shop details and activity
- Monitor subscription status

### Dashboard (/dashboard)

- Platform overview
- Active vs suspended shops
- Growth metrics
- System health status

## 🔒 Security Notes

1. **Middleware Protection**: All routes except /login and /unauthorized require auth
2. **RLS Policies**: Database level security for all admin tables
3. **Audit Logging**: Every admin action is logged with timestamp, IP, user agent
4. **Permission Checks**: Server-side permission validation before sensitive operations

## 📝 Next Steps

1. ✅ Complete migration & create super admin
2. ✅ Login to admin panel
3. ⏳ Test shop suspension/unsuspension
4. ⏳ Review audit logs
5. ⏳ Configure feature flags
6. ⏳ Set up limit overrides
7. ⏳ Deploy to production

## 🆘 Troubleshooting

### "Access Denied" Error

- Verify user is in `super_admins` table
- Check `is_active = true`
- Ensure permissions JSONB is valid

### Migration Fails

- Check if tables already exist
- Verify Supabase project has UUID extension
- Run migrations in order

### Login Redirects to /unauthorized

- User exists in auth.users but NOT in super_admins
- Run Step 2b to grant super admin access

### Port 9003 Already in Use

```bash
# Change port in package.json dev script
"dev": "next dev -p 9004"
```

## 📚 File Structure

```
swarnavyapar-admin/
├── migrations/               # Database migrations
│   └── 001_admin_infrastructure.sql
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # Protected routes
│   │   │   ├── dashboard/
│   │   │   ├── shops/
│   │   │   └── ...
│   │   ├── login/
│   │   └── unauthorized/
│   ├── components/ui/       # Reusable UI components
│   ├── services/            # Business logic
│   │   ├── admin-auth.service.ts
│   │   └── shop-management.service.ts
│   ├── lib/
│   │   ├── supabase/
│   │   └── utils.ts
│   └── types/
└── package.json
```

## 🎨 Admin Color Scheme

The admin panel uses a purple/indigo theme (admin-50 to admin-950) to differentiate from the main app:

- Primary: `bg-admin-600` (purple)
- Hover: `hover:bg-admin-700`
- Light: `bg-admin-100`

## ✅ Deployment Checklist

- [ ] Run migration on production Supabase
- [ ] Create production super admin
- [ ] Set production environment variables
- [ ] Enable IP whitelisting (optional)
- [ ] Configure MFA for super admins
- [ ] Test all critical flows
- [ ] Set up monitoring (Sentry)
- [ ] Document runbook for team

## 🔗 Useful Links

- Main App: http://localhost:9002
- Admin Panel: http://localhost:9003
- Supabase Dashboard: https://app.supabase.com
- Documentation: /docs/

---

**Need Help?** Check README.md for detailed documentation.
