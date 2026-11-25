import { requireSuperAdmin } from '@/services/admin-auth.service';
import { AdminShell } from './_components/admin-shell';

// Auth reads cookies via requireSuperAdmin — never statically prerender.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return <AdminShell adminName={admin.name || admin.email}>{children}</AdminShell>;
}
