'use server';

import { cache } from 'react';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireAdminPermission } from './admin-auth.service';

export type TenantPulse = {
  id: string;
  name: string;
  plan: string;
  planId: string;
  subscriptionStatus: string;
  mrrInr: number;
  gmv30d: number;
  collected30d: number;
  balanceDue: number;
  invoices30d: number;
  availableMc: number;
  heldMc: number;
  frozen: boolean;
  lowCredits: boolean;
  lastActivityAt: string | null;
  suspended: boolean;
};

export type CommandCenter = {
  generatedAt: string;
  shops: {
    total: number;
    active: number;
    suspended: number;
    quiet14d: number;
    new30d: number;
  };
  subscriptions: {
    active: number;
    mrrInr: number;
    byPlan: { plan: string; name: string; status: string; count: number }[];
  };
  commerce: {
    gmv30d: number;
    collected30d: number;
    balanceDue: number;
    invoices30d: number;
    invoicesToday: number;
  };
  credits: {
    availableMc: number;
    heldMc: number;
    emptyWallets: number;
    lowWallets: number;
    frozen: number;
    spent30dMc: number;
  };
  product: {
    catalogueProducts: number;
    catalogueEvents7d: number;
    catalogueLeads: number;
    whatsappMessages30d: number;
    whatsappFailed: number;
    whatsappConnected: number;
    aiUsageMonth: number;
    inventoryItems: number;
    customers: number;
  };
  ops: {
    openTickets: number;
    cronFailures7d: number;
    billingEvents: number;
  };
  tickets: { id: string; title: string; detail: string }[];
  tenants: TenantPulse[];
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * One service-role read of public.admin_command_center_snapshot().
 * Replaces the overview's fan-out of count queries.
 */
export const getCommandCenter = cache(async (): Promise<CommandCenter> => {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('admin_command_center_snapshot');
  if (error) throw error;

  const raw = asRecord(data);
  const shops = asRecord(raw.shops);
  const subscriptions = asRecord(raw.subscriptions);
  const commerce = asRecord(raw.commerce);
  const credits = asRecord(raw.credits);
  const product = asRecord(raw.product);
  const ops = asRecord(raw.ops);
  const attention = Array.isArray(raw.attention) ? raw.attention : [];
  const tenants = Array.isArray(raw.tenants) ? raw.tenants : [];

  return {
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    shops: {
      total: num(shops.total),
      active: num(shops.active),
      suspended: num(shops.suspended),
      quiet14d: num(shops.quiet14d),
      new30d: num(shops.new30d),
    },
    subscriptions: {
      active: num(subscriptions.active),
      mrrInr: num(subscriptions.mrrInr),
      byPlan: (Array.isArray(subscriptions.byPlan) ? subscriptions.byPlan : []).map(
        (row) => {
          const plan = asRecord(row);
          return {
            plan: String(plan.plan ?? ''),
            name: String(plan.name ?? ''),
            status: String(plan.status ?? ''),
            count: num(plan.count),
          };
        }
      ),
    },
    commerce: {
      gmv30d: num(commerce.gmv30d),
      collected30d: num(commerce.collected30d),
      balanceDue: num(commerce.balanceDue),
      invoices30d: num(commerce.invoices30d),
      invoicesToday: num(commerce.invoicesToday),
    },
    credits: {
      availableMc: num(credits.availableMc),
      heldMc: num(credits.heldMc),
      emptyWallets: num(credits.emptyWallets),
      lowWallets: num(credits.lowWallets),
      frozen: num(credits.frozen),
      spent30dMc: num(credits.spent30dMc),
    },
    product: {
      catalogueProducts: num(product.catalogueProducts),
      catalogueEvents7d: num(product.catalogueEvents7d),
      catalogueLeads: num(product.catalogueLeads),
      whatsappMessages30d: num(product.whatsappMessages30d),
      whatsappFailed: num(product.whatsappFailed),
      whatsappConnected: num(product.whatsappConnected),
      aiUsageMonth: num(product.aiUsageMonth),
      inventoryItems: num(product.inventoryItems),
      customers: num(product.customers),
    },
    ops: {
      openTickets: num(ops.openTickets),
      cronFailures7d: num(ops.cronFailures7d),
      billingEvents: num(ops.billingEvents),
    },
    tickets: attention
      .map((row) => asRecord(row))
      .filter((row) => row.kind === 'open_ticket')
      .map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Ticket'),
        detail: String(row.detail ?? ''),
      })),
    tenants: tenants.map((row) => {
      const shop = asRecord(row);
      return {
        id: String(shop.id ?? ''),
        name: String(shop.name ?? 'Shop'),
        plan: String(shop.plan ?? 'No plan'),
        planId: String(shop.planId ?? 'none'),
        subscriptionStatus: String(shop.subscriptionStatus ?? 'none'),
        mrrInr: num(shop.mrrInr),
        gmv30d: num(shop.gmv30d),
        collected30d: num(shop.collected30d),
        balanceDue: num(shop.balanceDue),
        invoices30d: num(shop.invoices30d),
        availableMc: num(shop.availableMc),
        heldMc: num(shop.heldMc),
        frozen: Boolean(shop.frozen),
        lowCredits: Boolean(shop.lowCredits),
        lastActivityAt: shop.lastActivityAt ? String(shop.lastActivityAt) : null,
        suspended: Boolean(shop.suspended),
      };
    }),
  };
});
