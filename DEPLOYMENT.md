# 🚀 DEPLOYMENT CHECKLIST - SWARNAVYAPAR ADMIN

## Pre-Deployment Tasks

### 1. Database Setup

- [ ] Run `migrations/001_admin_infrastructure.sql` on production Supabase
- [ ] Run `migrations/002_seed_data.sql` for sample data (optional)
- [ ] Verify all tables created successfully
- [ ] Verify RLS policies are active
- [ ] Test helper functions (is_super_admin, etc.)

### 2. Super Admin Accounts

- [ ] Create first super admin user in Supabase Auth
- [ ] Grant super admin permissions in database
- [ ] Test login with first super admin
- [ ] Create backup super admin account
- [ ] Document admin credentials securely (1Password, etc.)

### 3. Environment Configuration

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` (production)
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production)
- [ ] Set `NEXT_PUBLIC_APP_URL` (production domain)
- [ ] Configure `ADMIN_IP_WHITELIST` (optional)
- [ ] Set up Sentry DSN (optional)
- [ ] Configure analytics (optional)

### 4. Security Hardening

- [ ] Enable MFA for all super admins
- [ ] Review and update IP whitelist in middleware
- [ ] Set strong session timeout (default: 30 min)
- [ ] Configure CSP headers in next.config.ts
- [ ] Enable HTTPS only (production)
- [ ] Review all RLS policies
- [ ] Test unauthorized access scenarios

### 5. Code Quality

- [ ] Run `npm run typecheck` - No errors
- [ ] Run `npm run lint` - No errors
- [ ] Run `npm run build` - Successful build
- [ ] Test all critical user flows
- [ ] Verify error handling
- [ ] Check console for warnings

---

## Deployment Options

### Option A: Vercel (Recommended)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Set environment variables in Vercel dashboard
# 5. Deploy to production
vercel --prod
```

**Vercel Configuration:**

- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`
- Development Command: `next dev -p 9003`

**Environment Variables to Set:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
ADMIN_IP_WHITELIST (optional)
SENTRY_DSN (optional)
```

### Option B: Docker

```bash
# 1. Build image
docker build -t swarnavyapar-admin .

# 2. Test locally
docker run -p 9003:9003 --env-file .env.local swarnavyapar-admin

# 3. Push to registry
docker tag swarnavyapar-admin registry.example.com/swarnavyapar-admin:latest
docker push registry.example.com/swarnavyapar-admin:latest

# 4. Deploy to your platform (AWS, GCP, Azure, etc.)
```

### Option C: Self-Hosted (PM2)

```bash
# 1. Build
npm run build

# 2. Install PM2
npm install -g pm2

# 3. Start with PM2
pm2 start npm --name "swarnavyapar-admin" -- start

# 4. Save PM2 config
pm2 save

# 5. Setup PM2 startup
pm2 startup
```

---

## Post-Deployment Verification

### 1. Functional Testing

- [ ] Access admin panel at production URL
- [ ] Login with super admin credentials
- [ ] Dashboard loads with correct stats
- [ ] View shops list
- [ ] View individual shop details
- [ ] Test shop suspension flow
- [ ] Test shop unsuspension flow
- [ ] Verify audit log entries created
- [ ] Test logout
- [ ] Verify unauthorized access blocked

### 2. Security Testing

- [ ] Attempt access without auth → Redirects to /login
- [ ] Attempt access with regular user → Redirects to /unauthorized
- [ ] Verify middleware protection on all routes
- [ ] Test RLS policies (non-admin cannot see admin tables)
- [ ] Verify audit logging captures all actions
- [ ] Check HTTPS enforced
- [ ] Review security headers in browser
- [ ] Test session timeout

### 3. Performance Testing

- [ ] Dashboard loads in < 2 seconds
- [ ] Shops list loads in < 3 seconds
- [ ] Shop details page loads in < 2 seconds
- [ ] Database queries optimized (check Supabase logs)
- [ ] No console errors in production
- [ ] Lighthouse score > 90

### 4. Monitoring Setup

- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring (UptimeRobot, etc.)
- [ ] Configure database alerts in Supabase
- [ ] Set up log aggregation
- [ ] Create admin dashboard for monitoring

---

## Operational Procedures

### Daily Operations

- [ ] Review audit log for suspicious activity
- [ ] Check system health dashboard
- [ ] Monitor suspended shops count
- [ ] Review error logs

### Weekly Operations

- [ ] Review shop health scores
- [ ] Analyze platform growth metrics
- [ ] Clean up expired overrides (automatic via cron)
- [ ] Review feature flag rollouts
- [ ] Backup database

### Monthly Operations

- [ ] Review and rotate super admin credentials
- [ ] Audit RLS policies
- [ ] Review and update documentation
- [ ] Performance optimization review
- [ ] Security audit

---

## Emergency Procedures

### Shop Access Issues

```sql
-- Emergency unsuspend
UPDATE shops
SET is_suspended = false,
    suspension_reason = null,
    suspended_at = null,
    suspended_by = null
WHERE id = 'shop-id-here';
```

### Admin Lockout

```sql
-- Grant super admin access to existing user
INSERT INTO super_admins (user_id, name, email, permissions, is_active)
VALUES (
  'user-id-from-auth-users',
  'Emergency Admin',
  'admin@example.com',
  '{"manage_shops":true,"manage_users":true,"manage_limits":true,"manage_features":true,"view_analytics":true,"system_settings":true}'::jsonb,
  true
);
```

### Database Issues

1. Check Supabase dashboard for service status
2. Review recent migrations
3. Check connection pool limits
4. Review slow query log
5. Contact Supabase support if needed

---

## Rollback Plan

### If Issues Occur Post-Deployment

**Option 1: Revert Deployment**

```bash
# Vercel
vercel rollback

# PM2
pm2 restart swarnavyapar-admin@previous
```

**Option 2: Disable Admin Access**

```sql
-- Temporarily disable all admin access
UPDATE super_admins SET is_active = false;
```

**Option 3: Database Rollback**

```sql
-- Drop admin tables (DANGER - loses data)
DROP TABLE IF EXISTS super_admin_audit_log CASCADE;
DROP TABLE IF EXISTS shop_suspensions CASCADE;
-- ... etc
```

---

## Maintenance Schedule

### Scheduled Downtime

- [ ] Announce maintenance window via platform announcements
- [ ] Schedule during low-traffic period
- [ ] Prepare rollback plan
- [ ] Communicate with stakeholders

### Cleanup Jobs

Set up cron jobs in Supabase:

```sql
-- Run daily at 2 AM
SELECT cron.schedule(
  'cleanup-expired-overrides',
  '0 2 * * *',
  $$ SELECT cleanup_expired_overrides(); $$
);

-- Capture system health every hour
SELECT cron.schedule(
  'system-health-snapshot',
  '0 * * * *',
  $$ SELECT capture_system_health_snapshot(); $$
);
```

---

## Support Contacts

- **Development Team**: dev@example.com
- **Database Admin**: dba@example.com
- **Security Team**: security@example.com
- **Supabase Support**: https://supabase.com/support
- **Emergency Hotline**: [Add your number]

---

## Documentation Links

- [README.md](./README.md) - Complete documentation
- [SETUP.md](./SETUP.md) - Quick start guide
- [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) - What was built
- [Supabase Dashboard](https://app.supabase.com)
- [Main App Repository](../SwarnaVyapar)

---

## Final Checklist

- [ ] All pre-deployment tasks completed
- [ ] Environment configured correctly
- [ ] Super admins created and tested
- [ ] Deployed to production
- [ ] Post-deployment verification passed
- [ ] Monitoring configured
- [ ] Team trained on admin panel
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Emergency procedures documented

---

## Success Criteria

✅ **Admin panel accessible at production URL**  
✅ **Super admins can login successfully**  
✅ **All core features functional**  
✅ **Security measures in place**  
✅ **Monitoring active**  
✅ **Zero critical errors**  
✅ **Performance targets met**  
✅ **Team trained**

---

## 🎉 You're Ready to Deploy!

Once all items are checked, your SwarnaVyapar Admin Dashboard is production-ready.

**Last Updated**: 2026-06-24  
**Version**: 1.0.0  
**Status**: Production Ready ✅
