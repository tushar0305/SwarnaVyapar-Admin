'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireSuperAdmin, requireAdminPermission, logAdminAction } from './admin-auth.service';
import { fanOutShopNotifications } from './shop-inbox.service';
import {
  classifyShopHealth,
  type ShopHealthCounts,
  type HealthStep,
} from '@/lib/shop-health';

export type OnboardingStep = HealthStep & { completedAt?: string };

export interface OnboardingStatus {
  shopId: string;
  shopName: string;
  overallProgress: number;
  steps: OnboardingStep[];
  startedAt: string;
  completedAt?: string;
  needsAssistance: boolean;
}

export type ActivationRow = {
  shopId: string;
  shopName: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  planId: string | null;
  /** ₹499 one-time Google review QR add-on. */
  googleReviewsUnlocked: boolean;
  googleReviewsUnlockedAt: string | null;
  counts: ShopHealthCounts;
  primary: ReturnType<typeof classifyShopHealth>['primary'];
  upgradeReady: boolean;
  needsAssistance: boolean;
  overallProgress: number;
  score: number;
  tags: string[];
  activated: boolean;
  steps: HealthStep[];
};

export type ActivationSnapshot = {
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    needsHelp: number;
    avgProgress: number;
  };
  shops: ActivationRow[];
  truncated: boolean;
};

const SNAPSHOT_CAP = 200;

type ShopRow = {
  id: string;
  shop_name: string;
  phone_number: string | null;
  email: string | null;
  created_at: string;
  gst_number: string | null;
  last_activity_at: string | null;
  is_suspended: boolean | null;
  google_reviews_unlocked_at: string | null;
};

function emptyCounts(shop: ShopRow, planId: string | null): ShopHealthCounts {
  return {
    invoices: 0,
    customers: 0,
    inventory: 0,
    staff: 0,
    schemes: 0,
    loans: 0,
    khata: 0,
    whatsappConnected: false,
    hasGst: Boolean(shop.gst_number?.trim()),
    planId,
    lastActivityAt: shop.last_activity_at,
    createdAt: shop.created_at,
    isSuspended: Boolean(shop.is_suspended),
  };
}

function addCount(
  map: Map<string, ShopHealthCounts>,
  shopId: string | null,
  key: keyof Pick<
    ShopHealthCounts,
    'invoices' | 'customers' | 'inventory' | 'staff' | 'schemes' | 'loans' | 'khata'
  >
) {
  if (!shopId) return;
  const row = map.get(shopId);
  if (!row) return;
  row[key] += 1;
}

async function countRowsByShop(
  table: string,
  shopIds: string[],
  key: Parameters<typeof addCount>[2],
  map: Map<string, ShopHealthCounts>,
  opts?: { softDelete?: boolean; activeOnly?: boolean }
) {
  if (shopIds.length === 0) return;
  const supabase = getServiceRoleClient();
  const page = 1000;
  let from = 0;
  // ponytail: page shop_id rows if the activation RPC is not applied yet
  while (from < 20_000) {
    let q = supabase
      .from(table)
      .select('shop_id')
      .in('shop_id', shopIds)
      .range(from, from + page - 1);
    if (opts?.softDelete) q = q.is('deleted_at', null);
    if (opts?.activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error || !data?.length) break;
    for (const row of data) addCount(map, row.shop_id, key);
    if (data.length < page) break;
    from += page;
  }
}

async function loadCountsFallback(
  shops: ShopRow[],
  planByShop: Map<string, string | null>
): Promise<Map<string, ShopHealthCounts>> {
  const map = new Map<string, ShopHealthCounts>();
  for (const shop of shops) {
    map.set(shop.id, emptyCounts(shop, planByShop.get(shop.id) ?? null));
  }
  const ids = shops.map((s) => s.id);
  await Promise.all([
    countRowsByShop('invoices', ids, 'invoices', map, { softDelete: true }),
    countRowsByShop('customers', ids, 'customers', map, { softDelete: true }),
    countRowsByShop('inventory_items', ids, 'inventory', map, { softDelete: true }),
    countRowsByShop('user_shop_roles', ids, 'staff', map, { activeOnly: true }),
    countRowsByShop('schemes', ids, 'schemes', map),
    countRowsByShop('loans', ids, 'loans', map),
    countRowsByShop('khatabook_contacts', ids, 'khata', map, { softDelete: true }),
  ]);

  const supabase = getServiceRoleClient();
  const { data: wa } = await supabase
    .from('whatsapp_configs')
    .select('shop_id, status, onboarding_status')
    .in('shop_id', ids);
  for (const row of wa || []) {
    const connected =
      row.status === 'connected' || row.onboarding_status === 'connected';
    const counts = map.get(row.shop_id);
    if (counts && connected) counts.whatsappConnected = true;
  }
  return map;
}

async function loadCountsRpc(
  shops: ShopRow[],
  planByShop: Map<string, string | null>
): Promise<Map<string, ShopHealthCounts> | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('admin_shop_activation_counts');
  if (error || !Array.isArray(data)) return null;

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    if (row?.shop_id) byId.set(row.shop_id as string, row);
  }

  const map = new Map<string, ShopHealthCounts>();
  for (const shop of shops) {
    const raw = byId.get(shop.id);
    const base = emptyCounts(shop, planByShop.get(shop.id) ?? null);
    if (!raw) {
      map.set(shop.id, base);
      continue;
    }
    map.set(shop.id, {
      ...base,
      invoices: Number(raw.invoices || 0),
      customers: Number(raw.customers || 0),
      inventory: Number(raw.inventory || 0),
      staff: Number(raw.staff || 0),
      schemes: Number(raw.schemes || 0),
      loans: Number(raw.loans || 0),
      khata: Number(raw.khata || 0),
      whatsappConnected: Boolean(raw.whatsapp_connected),
    });
  }
  return map;
}

async function latestPlans(shopIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (shopIds.length === 0) return map;
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('shop_id, plan_id, created_at')
    .in('shop_id', shopIds)
    .order('created_at', { ascending: false });
  for (const row of data || []) {
    if (!map.has(row.shop_id)) map.set(row.shop_id, row.plan_id ?? null);
  }
  return map;
}

function toRow(shop: ShopRow, counts: ShopHealthCounts): ActivationRow {
  const health = classifyShopHealth(counts);
  const unlockedAt = shop.google_reviews_unlocked_at;
  return {
    shopId: shop.id,
    shopName: shop.shop_name,
    phone: shop.phone_number,
    email: shop.email,
    createdAt: shop.created_at,
    lastActivityAt: shop.last_activity_at,
    planId: counts.planId,
    googleReviewsUnlocked: Boolean(unlockedAt),
    googleReviewsUnlockedAt: unlockedAt,
    counts,
    ...health,
  };
}

export async function getActivationSnapshot(limit = SNAPSHOT_CAP): Promise<ActivationSnapshot> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: shops, count } = await supabase
    .from('shops')
    .select(
      'id, shop_name, phone_number, email, created_at, gst_number, last_activity_at, is_suspended, google_reviews_unlocked_at',
      {
        count: 'exact',
      }
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  const list = (shops || []) as ShopRow[];
  const planByShop = await latestPlans(list.map((s) => s.id));
  const counts =
    (await loadCountsRpc(list, planByShop)) ||
    (await loadCountsFallback(list, planByShop));

  const rows = list.map((shop) => toRow(shop, counts.get(shop.id) || emptyCounts(shop, null)));

  const completed = rows.filter((r) => r.activated).length;
  const notStarted = rows.filter((r) => r.primary === 'never_started').length;
  const inProgress = rows.filter(
    (r) => !r.activated && r.primary !== 'never_started'
  ).length;
  const needsHelp = rows.filter((r) => r.needsAssistance).length;
  const avgProgress =
    rows.length === 0
      ? 0
      : rows.reduce((sum, r) => sum + r.overallProgress, 0) / rows.length;

  return {
    stats: {
      total: count ?? rows.length,
      completed,
      inProgress,
      notStarted,
      needsHelp,
      avgProgress,
    },
    shops: rows,
    truncated: (count ?? rows.length) > rows.length,
  };
}

export async function getShopOnboardingStatus(shopId: string): Promise<OnboardingStatus> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: shop, error } = await supabase
    .from('shops')
    .select(
      'id, shop_name, phone_number, email, created_at, gst_number, last_activity_at, is_suspended, google_reviews_unlocked_at'
    )
    .eq('id', shopId)
    .single();

  if (error || !shop) throw new Error('Shop not found');

  const planByShop = await latestPlans([shopId]);
  const counts = await loadCountsFallback([shop], planByShop);
  const row = toRow(shop, counts.get(shopId) || emptyCounts(shop, null));

  return {
    shopId: row.shopId,
    shopName: row.shopName,
    overallProgress: row.overallProgress,
    steps: row.steps,
    startedAt: row.createdAt,
    completedAt: row.activated ? row.counts.lastActivityAt || row.createdAt : undefined,
    needsAssistance: row.needsAssistance,
  };
}

export async function getAllOnboardingStatuses() {
  const snap = await getActivationSnapshot();
  return snap.shops.map((row) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    overallProgress: row.overallProgress,
    steps: row.steps,
    startedAt: row.createdAt,
    completedAt: row.activated ? row.lastActivityAt || row.createdAt : undefined,
    needsAssistance: row.needsAssistance,
  }));
}

/** Audit-only — there is no shop_onboarding_progress table. */
export async function markOnboardingStepComplete(
  shopId: string,
  stepId: string,
  notes?: string
) {
  await requireSuperAdmin();
  await logAdminAction(
    'onboarding_step_noted',
    'onboarding',
    shopId,
    { stepId, notes },
    `Noted onboarding step ${stepId}`
  );
}

/** Audit-only — there is no onboarding_assistance table. */
export async function sendOnboardingAssistance(
  shopId: string,
  assistanceType: 'email' | 'call' | 'tutorial'
) {
  await requireSuperAdmin();
  await logAdminAction(
    'onboarding_assistance_noted',
    'onboarding',
    shopId,
    { assistanceType },
    `Noted ${assistanceType} onboarding assistance`
  );
}

export async function getOnboardingStatistics() {
  const snap = await getActivationSnapshot();
  return snap.stats;
}

const NUDGE_COPY: Record<string, { title: string; message: string }> = {
  never_started: {
    title: 'Finish setting up your shop',
    message:
      'Your SwarnaVyapar shop is ready. Add a customer and create the first invoice to get going.',
  },
  stalled_billing: {
    title: 'Ready for your first invoice',
    message:
      'You already have stock or customers. Create the first bill from the counter to activate the shop.',
  },
  quiet: {
    title: 'We miss your counter',
    message:
      'It has been a while since the last invoice. Open Billing to get back into the daily rhythm.',
  },
  upgrade_ready: {
    title: 'You are close to a plan limit',
    message:
      'This shop is near a free-plan cap. Review Plans if you need more customers, stock, loans, or schemes.',
  },
  whatsapp_off: {
    title: 'Turn on WhatsApp sharing',
    message:
      'You can already bill. Connect WhatsApp so invoices and reminders go out from the counter.',
  },
  needs_help: {
    title: 'Need a hand getting started?',
    message:
      'Your shop has not billed yet. Open the app and complete GST, a customer, stock, then the first invoice.',
  },
};

export async function nudgeShop(input: {
  shopId: string;
  cohort?: string;
  title?: string;
  message?: string;
}) {
  await requireAdminPermission('manage_shops');
  const copy = NUDGE_COPY[input.cohort || ''] || NUDGE_COPY.needs_help;
  const title = (input.title || copy.title).trim();
  const message = (input.message || copy.message).trim();

  const sent = await fanOutShopNotifications({
    shopIds: [input.shopId],
    title,
    message,
    type: 'info',
    link: '/notifications',
  });

  await logAdminAction(
    'activation_nudge_sent',
    'shop',
    input.shopId,
    { cohort: input.cohort ?? null, title, sent },
    `Sent activation nudge to shop inbox`
  );

  return { sent };
}
