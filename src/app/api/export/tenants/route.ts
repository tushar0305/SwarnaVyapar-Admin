import { NextResponse } from 'next/server';
import { getCommandCenter } from '@/services/command-center.service';
import { requireAdminPermission } from '@/services/admin-auth.service';

export const dynamic = 'force-dynamic';

function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  await requireAdminPermission('view_analytics');
  const data = await getCommandCenter();

  const header = [
    'shop_id',
    'shop_name',
    'plan',
    'subscription_status',
    'mrr_inr',
    'sales_30d_inr',
    'collected_30d_inr',
    'balance_due_inr',
    'invoices_30d',
    'credits_available',
    'wallet_frozen',
    'last_activity_at',
    'suspended',
  ];
  const rows = data.tenants.map((t) =>
    [
      t.id,
      t.name,
      t.plan,
      t.subscriptionStatus,
      t.mrrInr,
      t.gmv30d,
      t.collected30d,
      t.balanceDue,
      t.invoices30d,
      t.availableMc / 500,
      t.frozen,
      t.lastActivityAt ?? '',
      t.suspended,
    ]
      .map(cell)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="swarnavyapar-tenants-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
