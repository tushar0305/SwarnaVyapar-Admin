import { requireSuperAdmin } from '@/services/admin-auth.service';
import { AdminShell } from './_components/admin-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return <AdminShell adminName={admin.name || admin.email}>{children}</AdminShell>;
}
