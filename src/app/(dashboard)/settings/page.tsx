import { Shield, Database, Activity, MessageCircle } from 'lucide-react';
import { getWhatsAppStatus } from '@/services/whatsapp-outreach.service';
import { WhatsAppConnection } from '../whatsapp/_components/whatsapp-connection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireSuperAdmin } from '@/services/admin-auth.service';
import { getCommandCenter } from '@/services/command-center.service';
import { getUserStatistics } from '@/services/user-management.service';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { isAdminAuthBypassed } from '@/lib/admin-security';
import { isLocalBypassAdminId } from '@/lib/admin-ids';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '../_components/page-header';

export default async function SettingsPage() {
  const admin = await requireSuperAdmin();
  const [center, users, adminCount, whatsapp] = await Promise.all([
    getCommandCenter(),
    getUserStatistics(),
    getServiceRoleClient()
      .from('super_admins')
      .select('id', { count: 'exact', head: true })
      .then((res) => res.count || 0),
    getWhatsAppStatus(),
  ]);

  const localBypass = isAdminAuthBypassed() && isLocalBypassAdminId(admin.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Settings"
        subtitle="Signed-in operator identity and live platform counts"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-700" />
            Super Admin Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-ink-500">Name</p>
              <p className="text-sm font-medium text-ink-900">{admin.name}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Email</p>
              <p className="text-sm font-medium text-ink-900">{admin.email}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Role</p>
              <Badge variant="success">Super Admin</Badge>
            </div>
            <div>
              <p className="text-sm text-ink-500">Auth mode</p>
              <Badge variant={localBypass ? 'secondary' : 'success'}>
                {localBypass ? 'Local bypass' : 'Signed in'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-ink-500">Created</p>
              <p className="text-sm">
                {localBypass ? 'Local session' : formatDateTime(admin.created_at)}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Last login</p>
              <p className="text-sm">
                {admin.last_login_at ? formatDateTime(admin.last_login_at) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gold-700" />
            Platform Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="text-center">
              <p className="tnum text-xl font-semibold text-gold-700">{center.shops.total}</p>
              <p className="mt-0.5 text-sm text-ink-500">Total shops</p>
            </div>
            <div className="text-center">
              <p className="tnum text-xl font-semibold text-gold-700">{center.shops.active}</p>
              <p className="mt-0.5 text-sm text-ink-500">Active shops</p>
            </div>
            <div className="text-center">
              <p className="tnum text-xl font-semibold text-gold-700">{users.totalUsers}</p>
              <p className="mt-0.5 text-sm text-ink-500">Shop members</p>
            </div>
            <div className="text-center">
              <p className="tnum text-xl font-semibold text-gold-700">{adminCount}</p>
              <p className="mt-0.5 text-sm text-ink-500">Super admins</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Snapshot {formatDateTime(center.generatedAt)} · service-role command center
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-gold-700" />
            WhatsApp Cloud API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppConnection initial={whatsapp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gold-700" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-ink-600">Admin panel version</span>
              <span className="text-sm font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-ink-600">Database</span>
              <Badge variant="success">Reachable</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-ink-600">Authentication</span>
              <Badge variant={localBypass ? 'secondary' : 'success'}>
                {localBypass ? 'Bypassed locally' : 'Active'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-ink-600">Audit logging</span>
              <Badge variant="success">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
