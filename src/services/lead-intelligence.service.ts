'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { logAdminAction, requireAdminPermission, requireSuperAdmin } from './admin-auth.service';
import { sendWhatsAppToShop } from './whatsapp-outreach.service';
import { isUuid } from '@/lib/admin-ids';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp/phone';
import { classifyShopHealth, daysSince, type HealthStep, type PrimaryCohort } from '@/lib/shop-health';
import {
  fromDatetimeLocalIst,
  isLeadSortKey,
  istDayStart,
  istYmd,
  isStoredPipeline,
  joinSource,
  nextLeadAction,
  scoreLead,
  withinRolling,
  type JoinSource,
  type LeadSignals,
  type LeadSortKey,
  type NextAction,
  type PipelineStatus,
  type ScoreReason,
} from '@/lib/lead-score';

const PAGE_SIZE = 20;

export type LeadListFilters = {
  q?: string;
  joined?: string;
  pipeline?: string;
  band?: string;
  intent?: string;
  joinedAs?: string;
  cohort?: string;
  plan?: string;
  whatsapp?: string;
  owner?: string;
  live?: string;
  converted?: string;
  due?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

export type LeadCounts = {
  customers: number;
  inventory: number;
  invoices: number;
  catalogueProducts: number;
  cataloguePageViews: number;
  catalogueProductViews: number;
  catalogueWhatsappClicks: number;
  catalogueLeads: number;
  whatsappOutbound: number;
  aiEvents: number;
  schemes: number;
  loans: number;
  khata: number;
  supportTickets: number;
};

export type LeadMilestones = {
  firstCustomerAt: string | null;
  firstInventoryAt: string | null;
  firstInvoiceAt: string | null;
  firstCatalogueProductAt: string | null;
  latestProductViewAt: string | null;
  latestWhatsappOutAt: string | null;
  latestAiAt: string | null;
  whatsappConnectedAt: string | null;
};

export type LeadRow = {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  provider: string | null;
  phone: string | null;
  shopId: string | null;
  shopName: string | null;
  shopEmail: string | null;
  role: string | null;
  roleActive: boolean;
  suspended: boolean;
  joinedAt: string;
  accountCreatedAt: string;
  lastSignInAt: string | null;
  lastShopActivityAt: string | null;
  lastActiveAt: string | null;
  planId: string | null;
  planStatus: string | null;
  periodEnd: string | null;
  joinSource: JoinSource;
  pipeline: PipelineStatus;
  ownerName: string | null;
  followUpAt: string | null;
  cohort: PrimaryCohort | null;
  onboardingProgress: number | null;
  steps: HealthStep[];
  score: number;
  band: 'high' | 'medium' | 'low';
  reasons: ScoreReason[];
  highIntent: boolean;
  converted: boolean;
  conversionReason: string | null;
  active: boolean;
  returning: boolean;
  whatsappConnected: boolean;
  onboardingCompleted: boolean | null;
  onboardingStep: number | null;
  counts: LeadCounts;
  milestones: LeadMilestones;
  next: NextAction;
  latestNote: string | null;
  latestNoteAt: string | null;
};

export type LeadOverview = {
  people: number;
  rows: number;
  shops: number;
  shopLess: number;
  newToday: number;
  new7d: number;
  new30d: number;
  active: number;
  returning: number;
  whatsappConnected: number;
  highIntent: number;
  converted: number;
  contacted: number;
  callback: number;
  noAnswer: number;
  truncated: boolean;
};

export type LeadBoard = {
  overview: LeadOverview;
  rows: LeadRow[];
  filteredPeople: number;
  total: number;
  page: number;
  pageSize: number;
  owners: string[];
  followUps: LeadRow[];
  highIntentQueue: LeadRow[];
  generatedAt: string;
};

export type TimelineItem = {
  id: string;
  at: string;
  label: string;
  detail: string | null;
};

export type CatalogueInterest = {
  productId: string;
  name: string;
  views: number;
};

export type CommunicationItem = {
  id: string;
  at: string;
  channel: string;
  summary: string;
  status: string | null;
};

export type LeadNote = {
  id: string;
  body: string;
  createdAt: string;
};

export type LeadDetail = {
  row: LeadRow;
  timeline: TimelineItem[];
  interests: CatalogueInterest[];
  communications: CommunicationItem[];
  notes: LeadNote[];
};

type SignalRow = {
  shop_id: string;
  customers: number;
  inventory: number;
  invoices: number;
  catalogue_products: number;
  catalogue_page_views: number;
  catalogue_product_views: number;
  catalogue_whatsapp_clicks: number;
  catalogue_leads: number;
  whatsapp_outbound: number;
  ai_events: number;
  schemes: number;
  loans: number;
  khata: number;
  support_tickets: number;
  first_customer_at: string | null;
  first_inventory_at: string | null;
  first_invoice_at: string | null;
  first_catalogue_product_at: string | null;
  latest_product_view_at: string | null;
  latest_whatsapp_out_at: string | null;
  latest_ai_at: string | null;
  whatsapp_connected: boolean;
  whatsapp_connected_at: string | null;
};

type ShopEmbed = {
  id: string;
  shop_name: string | null;
  phone_number: string | null;
  email: string | null;
  gst_number: string | null;
  created_at: string | null;
  created_by: string | null;
  last_activity_at: string | null;
  is_suspended: boolean | null;
};

type RoleRow = {
  id: string;
  user_id: string;
  shop_id: string;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  shop: ShopEmbed | ShopEmbed[] | null;
};

type LeadRecord = {
  user_id: string;
  shop_id: string;
  status: string;
  owner_name: string | null;
  follow_up_at: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time) && time > bestTime) {
      bestTime = time;
      best = value;
    }
  }
  return best;
}

function personName(meta: User['user_metadata'] | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const record = meta as Record<string, unknown>;
  const name = record.full_name || record.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function providerOf(user: User | undefined): string | null {
  const provider = user?.app_metadata?.provider;
  return typeof provider === 'string' ? provider : null;
}

function emptyCounts(): LeadCounts {
  return {
    customers: 0,
    inventory: 0,
    invoices: 0,
    catalogueProducts: 0,
    cataloguePageViews: 0,
    catalogueProductViews: 0,
    catalogueWhatsappClicks: 0,
    catalogueLeads: 0,
    whatsappOutbound: 0,
    aiEvents: 0,
    schemes: 0,
    loans: 0,
    khata: 0,
    supportTickets: 0,
  };
}

function emptyMilestones(): LeadMilestones {
  return {
    firstCustomerAt: null,
    firstInventoryAt: null,
    firstInvoiceAt: null,
    firstCatalogueProductAt: null,
    latestProductViewAt: null,
    latestWhatsappOutAt: null,
    latestAiAt: null,
    whatsappConnectedAt: null,
  };
}

function isRetryableAuthFetch(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; status?: number; code?: string; cause?: { code?: string }; message?: string };
  if (err.name === 'AuthRetryableFetchError') return true;
  if (err.status === 0) return true;
  const code = err.code || err.cause?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'UND_ERR_SOCKET';
}

async function listUsersPage(supabase: SupabaseClient, page: number, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!error) return data;
    lastError = error;
    if (!isRetryableAuthFetch(error) || attempt === attempts) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw lastError;
}

async function listAuthUsers(supabase: SupabaseClient) {
  const users: User[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const data = await listUsersPage(supabase, page);
    users.push(...data.users);
    if (data.users.length < 200) return { users, truncated: false };
  }
  return { users, truncated: true };
}

async function fetchRange<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; truncated: boolean }> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < 5000; from += size) {
    const { data, error } = await load(from, from + size - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < size) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const loadLeadRows = cache(async (): Promise<{ rows: LeadRow[]; owners: string[]; truncated: boolean }> => {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const now = Date.now();

  const [auth, rolesPage, signalResult, prefPage, profilePage, subPage, leadPage, notesPage] =
    await Promise.all([
      listAuthUsers(supabase),
      fetchRange<RoleRow>((from, to) =>
        supabase
          .from('user_shop_roles')
          .select(
            'id, user_id, shop_id, role, is_active, created_at, shop:shops(id, shop_name, phone_number, email, gst_number, created_at, created_by, last_activity_at, is_suspended)'
          )
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      supabase.rpc('admin_lead_shop_signals'),
      fetchRange<{
        user_id: string;
        onboarding_completed: boolean | null;
        onboarding_step: number | null;
      }>((from, to) =>
        supabase
          .from('user_preferences')
          .select('user_id, onboarding_completed, onboarding_step')
          .range(from, to)
      ),
      fetchRange<{ user_id: string; shop_id: string; name: string | null }>((from, to) =>
        supabase.from('staff_profiles').select('user_id, shop_id, name').range(from, to)
      ),
      fetchRange<{
        shop_id: string;
        plan_id: string | null;
        status: string | null;
        created_at: string;
        current_period_end: string | null;
      }>((from, to) =>
        supabase
          .from('subscriptions')
          .select('shop_id, plan_id, status, created_at, current_period_end')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchRange<LeadRecord>((from, to) =>
        supabase
          .from('admin_lead_records')
          .select('user_id, shop_id, status, owner_name, follow_up_at')
          .range(from, to)
      ),
      fetchRange<{ user_id: string; shop_id: string; body: string; created_at: string }>((from, to) =>
        supabase
          .from('admin_lead_notes')
          .select('user_id, shop_id, body, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      ),
    ]);

  if (signalResult.error) throw new Error(signalResult.error.message);

  const signals = new Map<string, SignalRow>();
  for (const row of (signalResult.data || []) as SignalRow[]) {
    signals.set(row.shop_id, row);
  }

  const users = new Map(auth.users.map((user) => [user.id, user]));
  const prefs = new Map(prefPage.rows.map((row) => [row.user_id, row]));
  const staffName = new Map<string, string>();
  for (const profile of profilePage.rows) {
    if (profile.name?.trim()) staffName.set(`${profile.user_id}:${profile.shop_id}`, profile.name.trim());
  }
  const plans = new Map<string, { planId: string | null; status: string | null; periodEnd: string | null }>();
  for (const sub of subPage.rows) {
    if (!plans.has(sub.shop_id)) {
      plans.set(sub.shop_id, {
        planId: sub.plan_id,
        status: sub.status,
        periodEnd: sub.current_period_end,
      });
    }
  }
  const records = new Map<string, LeadRecord>();
  for (const record of leadPage.rows) {
    records.set(`${record.user_id}:${record.shop_id}`, record);
  }
  const latestNotes = new Map<string, { body: string; createdAt: string }>();
  for (const note of notesPage.rows) {
    const key = `${note.user_id}:${note.shop_id}`;
    if (!latestNotes.has(key) && note.body?.trim()) {
      latestNotes.set(key, { body: note.body.trim(), createdAt: note.created_at });
    }
  }

  const rolesByUser = new Map<string, RoleRow[]>();
  for (const role of rolesPage.rows) {
    const list = rolesByUser.get(role.user_id) || [];
    list.push(role);
    rolesByUser.set(role.user_id, list);
  }

  const rows: LeadRow[] = [];

  const build = (userId: string, role: RoleRow | null) => {
    const user = users.get(userId);
    const shop = role ? one(role.shop) : null;
    const shopId = role?.shop_id || null;
    const signal = shopId ? signals.get(shopId) : undefined;
    const plan = shopId ? plans.get(shopId) : undefined;
    const pref = prefs.get(userId);
    const record = shopId ? records.get(`${userId}:${shopId}`) : undefined;
    const accountCreatedAt = user?.created_at || role?.created_at || new Date(0).toISOString();
    const lastSignInAt = user?.last_sign_in_at || null;
    const returning = Boolean(
      lastSignInAt && accountCreatedAt && istYmd(lastSignInAt) > istYmd(accountCreatedAt)
    );
    const signedInRecently = withinRolling(lastSignInAt, 7, now);
    const shopActive = withinRolling(shop?.last_activity_at, 7, now);
    const suspended = Boolean(shop?.is_suspended);
    const roleActive = role ? role.is_active !== false : true;
    const counts = signal
      ? {
          customers: num(signal.customers),
          inventory: num(signal.inventory),
          invoices: num(signal.invoices),
          catalogueProducts: num(signal.catalogue_products),
          cataloguePageViews: num(signal.catalogue_page_views),
          catalogueProductViews: num(signal.catalogue_product_views),
          catalogueWhatsappClicks: num(signal.catalogue_whatsapp_clicks),
          catalogueLeads: num(signal.catalogue_leads),
          whatsappOutbound: num(signal.whatsapp_outbound),
          aiEvents: num(signal.ai_events),
          schemes: num(signal.schemes),
          loans: num(signal.loans),
          khata: num(signal.khata),
          supportTickets: num(signal.support_tickets),
        }
      : emptyCounts();
    const milestones: LeadMilestones = signal
      ? {
          firstCustomerAt: signal.first_customer_at,
          firstInventoryAt: signal.first_inventory_at,
          firstInvoiceAt: signal.first_invoice_at,
          firstCatalogueProductAt: signal.first_catalogue_product_at,
          latestProductViewAt: signal.latest_product_view_at,
          latestWhatsappOutAt: signal.latest_whatsapp_out_at,
          latestAiAt: signal.latest_ai_at,
          whatsappConnectedAt: signal.whatsapp_connected_at,
        }
      : emptyMilestones();
    const whatsappConnected = Boolean(signal?.whatsapp_connected);
    const leadSignals: LeadSignals = {
      ...counts,
      whatsappConnected,
      hasGst: Boolean(shop?.gst_number?.trim()),
      planId: plan?.planId ?? null,
      planStatus: plan?.status ?? null,
      signedInRecently,
      returning,
      suspended,
      roleActive,
    };
    const scored = scoreLead(leadSignals);
    const health = shop
      ? classifyShopHealth(
          {
            ...counts,
            staff: 0,
            whatsappConnected,
            hasGst: leadSignals.hasGst,
            planId: leadSignals.planId,
            lastActivityAt: shop.last_activity_at,
            createdAt: shop.created_at || accountCreatedAt,
            isSuspended: suspended,
          },
          now
        )
      : null;
    const pipeline: PipelineStatus = isStoredPipeline(record?.status || '')
      ? (record!.status as PipelineStatus)
      : 'unreviewed';
    const phone = shop?.phone_number?.trim() || null;
    const joinedAt = role?.created_at || accountCreatedAt;
    const source = joinSource({
      hasShop: Boolean(shopId),
      role: role?.role || null,
      shopCreatedBy: shop?.created_by || null,
      userId,
      shopCreatedAt: shop?.created_at || null,
      roleCreatedAt: role?.created_at || null,
    });
    const staff = shopId ? staffName.get(`${userId}:${shopId}`) : null;
    const note = shopId ? latestNotes.get(`${userId}:${shopId}`) : undefined;

    rows.push({
      id: role?.id || `user-${userId}`,
      userId,
      email: user?.email || null,
      name: staff || personName(user?.user_metadata),
      provider: providerOf(user),
      phone,
      shopId,
      shopName: shop?.shop_name || null,
      shopEmail: shop?.email || null,
      role: role?.role || null,
      roleActive,
      suspended,
      joinedAt,
      accountCreatedAt,
      lastSignInAt,
      lastShopActivityAt: shop?.last_activity_at || null,
      lastActiveAt: latestIso([lastSignInAt, shop?.last_activity_at]),
      planId: plan?.planId ?? null,
      planStatus: plan?.status ?? null,
      periodEnd: plan?.periodEnd ?? null,
      joinSource: source,
      pipeline,
      ownerName: record?.owner_name?.trim() || null,
      followUpAt: record?.follow_up_at || null,
      cohort: health?.primary ?? null,
      onboardingProgress: health ? Math.round(health.overallProgress) : null,
      steps: health?.steps ?? [],
      score: scored.score,
      band: scored.band,
      reasons: scored.reasons,
      highIntent: scored.highIntent,
      converted: scored.converted,
      conversionReason: scored.conversionReason,
      active: signedInRecently || shopActive,
      returning,
      whatsappConnected,
      onboardingCompleted: pref?.onboarding_completed ?? null,
      onboardingStep: pref?.onboarding_step ?? null,
      counts,
      milestones,
      next: nextLeadAction({
        hasShop: Boolean(shopId),
        hasPhone: Boolean(normalizeWhatsAppPhone(phone)),
        roleActive,
        suspended,
        highIntent: scored.highIntent,
        converted: scored.converted,
        cohort: health?.primary ?? null,
        pipeline,
        followUpAt: record?.follow_up_at || null,
        whatsappConnected,
        ageDays: daysSince(accountCreatedAt, now),
        now,
      }),
      latestNote: note?.body || null,
      latestNoteAt: note?.createdAt || null,
    });
  };

  for (const role of rolesPage.rows) build(role.user_id, role);
  for (const user of auth.users) {
    if (!rolesByUser.has(user.id)) build(user.id, null);
  }

  rows.sort((a, b) => compareRows(a, b, now));

  const owners = [...new Set(rows.map((row) => row.ownerName).filter((name): name is string => Boolean(name)))].sort(
    (a, b) => a.localeCompare(b)
  );

  return {
    rows,
    owners,
    truncated:
      auth.truncated ||
      rolesPage.truncated ||
      prefPage.truncated ||
      profilePage.truncated ||
      subPage.truncated ||
      leadPage.truncated ||
      notesPage.truncated,
  };
});

function isClosedPipeline(pipeline: string): boolean {
  return pipeline === 'lost' || pipeline === 'not_interested';
}

function personSortValue(row: LeadRow): string {
  return (row.name || row.email || '').toLowerCase();
}

function compareBySort(a: LeadRow, b: LeadRow, sort: LeadSortKey, dir: 'asc' | 'desc'): number {
  const mul = dir === 'asc' ? 1 : -1;
  const emptyLast = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? 1 : 0;

  let delta = 0;
  switch (sort) {
    case 'person':
      delta = emptyLast(personSortValue(a)) - emptyLast(personSortValue(b));
      if (delta === 0) delta = personSortValue(a).localeCompare(personSortValue(b));
      break;
    case 'shop':
      delta = emptyLast(a.shopName) - emptyLast(b.shopName);
      if (delta === 0) delta = (a.shopName || '').localeCompare(b.shopName || '');
      break;
    case 'signed_up':
      delta = new Date(a.accountCreatedAt).getTime() - new Date(b.accountCreatedAt).getTime();
      break;
    case 'last_active':
      delta = emptyLast(a.lastActiveAt) - emptyLast(b.lastActiveAt);
      if (delta === 0) {
        delta = new Date(a.lastActiveAt || 0).getTime() - new Date(b.lastActiveAt || 0).getTime();
      }
      break;
    case 'score':
      delta = a.score - b.score;
      break;
    case 'status':
      delta = a.pipeline.localeCompare(b.pipeline);
      break;
    case 'next':
      delta = a.next.label.localeCompare(b.next.label);
      break;
    case 'note':
      delta = emptyLast(a.latestNote) - emptyLast(b.latestNote);
      if (delta === 0) {
        delta = new Date(a.latestNoteAt || 0).getTime() - new Date(b.latestNoteAt || 0).getTime();
      }
      break;
  }
  if (delta !== 0) return delta * mul;
  return new Date(b.accountCreatedAt).getTime() - new Date(a.accountCreatedAt).getTime();
}

function compareRows(a: LeadRow, b: LeadRow, now: number): number {
  const due = (row: LeadRow) =>
    row.followUpAt &&
    !isClosedPipeline(row.pipeline) &&
    new Date(row.followUpAt).getTime() <= now
      ? 0
      : 1;
  const intent = (row: LeadRow) => (row.highIntent ? 0 : 1);
  const dueDelta = due(a) - due(b);
  if (dueDelta !== 0) return dueDelta;
  const intentDelta = intent(a) - intent(b);
  if (intentDelta !== 0) return intentDelta;
  return new Date(b.accountCreatedAt).getTime() - new Date(a.accountCreatedAt).getTime();
}

function countPeople(rows: LeadRow[], predicate: (row: LeadRow) => boolean): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (predicate(row)) ids.add(row.userId);
  }
  return ids.size;
}

function countShops(rows: LeadRow[]): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.shopId) ids.add(row.shopId);
  }
  return ids.size;
}

function overviewOf(rows: LeadRow[], truncated: boolean, now = new Date()): LeadOverview {
  const today = istDayStart(now).getTime();
  const created = (row: LeadRow) => new Date(row.accountCreatedAt).getTime();
  return {
    people: countPeople(rows, () => true),
    rows: rows.length,
    shops: countShops(rows),
    shopLess: rows.filter((row) => !row.shopId).length,
    newToday: countPeople(rows, (row) => created(row) >= today),
    new7d: countPeople(rows, (row) => withinRolling(row.accountCreatedAt, 7, now.getTime())),
    new30d: countPeople(rows, (row) => withinRolling(row.accountCreatedAt, 30, now.getTime())),
    active: countPeople(rows, (row) => row.active),
    returning: countPeople(rows, (row) => row.returning),
    whatsappConnected: countPeople(rows, (row) => row.whatsappConnected),
    highIntent: countPeople(rows, (row) => row.highIntent),
    converted: countPeople(rows, (row) => row.converted),
    contacted: countPeople(rows, (row) => row.pipeline === 'contacted'),
    callback: countPeople(rows, (row) => row.pipeline === 'callback'),
    noAnswer: countPeople(rows, (row) => row.pipeline === 'no_answer'),
    truncated,
  };
}

function matches(row: LeadRow, filters: LeadListFilters, now = Date.now()): boolean {
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const haystack = [row.name, row.email, row.shopName, row.phone, row.userId, row.role, row.shopEmail]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.joined === 'today' && new Date(row.accountCreatedAt).getTime() < istDayStart().getTime()) {
    return false;
  }
  if (filters.joined === '7d' && !withinRolling(row.accountCreatedAt, 7, now)) return false;
  if (filters.joined === '30d' && !withinRolling(row.accountCreatedAt, 30, now)) return false;
  if (filters.pipeline && row.pipeline !== filters.pipeline) return false;
  if (filters.band && row.band !== filters.band) return false;
  if (filters.intent === 'high' && !row.highIntent) return false;
  if (filters.joinedAs && row.joinSource !== filters.joinedAs) return false;
  if (filters.cohort && row.cohort !== filters.cohort) return false;
  if (filters.plan === 'none' && row.planId) return false;
  if (filters.plan && filters.plan !== 'none' && row.planId !== filters.plan) return false;
  if (filters.whatsapp === 'connected' && !row.whatsappConnected) return false;
  if (filters.whatsapp === 'off' && (!row.shopId || row.whatsappConnected)) return false;
  if (filters.owner === '__unassigned' && row.ownerName) return false;
  if (filters.owner && filters.owner !== '__unassigned' && row.ownerName !== filters.owner) return false;
  if (filters.live === 'active' && !row.active) return false;
  if (filters.live === 'returning' && !row.returning) return false;
  if (filters.converted === 'yes' && !row.converted) return false;
  if (filters.converted === 'no' && row.converted) return false;
  if (filters.due === '1') {
    const due =
      row.followUpAt &&
      !isClosedPipeline(row.pipeline) &&
      new Date(row.followUpAt).getTime() <= now;
    if (!due) return false;
  }
  return true;
}

export async function getLeadBoard(filters: LeadListFilters = {}): Promise<LeadBoard> {
  const loaded = await loadLeadRows();
  const now = Date.now();
  const filtered = loaded.rows.filter((row) => matches(row, filters, now));
  const sortKey = isLeadSortKey(filters.sort) ? filters.sort : null;
  const dir = filters.dir === 'asc' ? 'asc' : 'desc';
  const sorted = [...filtered].sort((a, b) =>
    sortKey ? compareBySort(a, b, sortKey, dir) : compareRows(a, b, now)
  );
  const requested = Number(filters.page) || 1;
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(requested, 1), pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const followUps = loaded.rows
    .filter(
      (row) =>
        row.followUpAt &&
        !isClosedPipeline(row.pipeline) &&
        new Date(row.followUpAt).getTime() <= now
    )
    .sort((a, b) => new Date(a.followUpAt || 0).getTime() - new Date(b.followUpAt || 0).getTime());
  const followUpIds = new Set(followUps.map((row) => row.id));

  return {
    overview: overviewOf(loaded.rows, loaded.truncated),
    rows: sorted.slice(start, start + PAGE_SIZE),
    filteredPeople: countPeople(sorted, () => true),
    total: sorted.length,
    page,
    pageSize: PAGE_SIZE,
    owners: loaded.owners,
    followUps: followUps.slice(0, 6),
    highIntentQueue: loaded.rows
      .filter(
        (row) =>
          row.highIntent &&
          (row.pipeline === 'unreviewed' || row.pipeline === 'new') &&
          !followUpIds.has(row.id)
      )
      .slice(0, 6),
    generatedAt: new Date().toISOString(),
  };
}

const AUDIT_LABEL: Record<string, string> = {
  'create:invoice': 'Created an invoice',
  'update:invoice': 'Updated an invoice',
  'create:customer': 'Added a customer',
  'update:customer': 'Updated a customer',
  'create:shop': 'Created the shop',
  'update:shop': 'Updated shop settings',
  'update:catalogue_settings': 'Updated catalogue settings',
  'create:catalogue_product': 'Published a catalogue product',
  'update:catalogue_product': 'Updated a catalogue product',
  'create:catalogue_category': 'Added a catalogue category',
  'create:khatabook_contact': 'Added a khata contact',
  'update:khatabook_contact': 'Updated a khata contact',
  'create:ledger_transaction': 'Recorded a khata entry',
  'create:staff': 'Added staff',
  'create:subscription': 'Started a subscription',
  'read:excel_export': 'Exported a spreadsheet',
  'create:jewellery_purchase': 'Recorded a purchase',
  'create:scheme_enrollment': 'Enrolled a scheme member',
  'create:scheme_payment': 'Recorded a scheme payment',
  'create:payment': 'Recorded a payment',
  'create:storage_upload_sign': 'Uploaded a file',
};

function auditLabel(action: string, entity: string): string {
  const key = `${action.toLowerCase()}:${entity.toLowerCase()}`;
  return AUDIT_LABEL[key] || `${action} ${entity.replaceAll('_', ' ')}`;
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const loaded = await loadLeadRows();
  const row = loaded.rows.find((item) => item.id === id);
  if (!row) return null;

  const timeline: TimelineItem[] = [
    { id: 'account', at: row.accountCreatedAt, label: 'Account created', detail: signInDetail(row) },
  ];
  if (row.returning && row.lastSignInAt) {
    timeline.push({
      id: 'signin',
      at: row.lastSignInAt,
      label: 'Signed in on a later day',
      detail: null,
    });
  }
  if (row.shopId && row.joinedAt) {
    timeline.push({
      id: 'joined',
      at: row.joinedAt,
      label: row.role ? `Joined as ${row.role}` : 'Joined the shop',
      detail: row.shopName,
    });
  }

  const milestone = (
    key: string,
    at: string | null,
    label: string,
    detail: string | null
  ) => {
    if (!at) return;
    timeline.push({ id: key, at, label, detail });
  };
  milestone('first-customer', row.milestones.firstCustomerAt, "Shop's first customer", 'Shop record, not a page view');
  milestone('first-stock', row.milestones.firstInventoryAt, "Shop's first stock item", 'Shop record, not a page view');
  milestone(
    'first-catalogue',
    row.milestones.firstCatalogueProductAt,
    'First catalogue product published',
    null
  );
  milestone('first-invoice', row.milestones.firstInvoiceAt, 'First invoice — shop converted', row.conversionReason);
  milestone('wa-connected', row.milestones.whatsappConnectedAt, 'Shop WhatsApp connected', null);
  if (row.counts.catalogueProductViews > 0) {
    milestone(
      'catalogue-views',
      row.milestones.latestProductViewAt,
      'Buyers viewed catalogue products',
      `${row.counts.catalogueProductViews} product views · ${row.counts.cataloguePageViews} page views. These are public visitors, not this login.`
    );
  }
  if (row.counts.whatsappOutbound > 0) {
    milestone(
      'wa-out',
      row.milestones.latestWhatsappOutAt,
      'Shop sent WhatsApp to a customer',
      `${row.counts.whatsappOutbound} outbound shop messages`
    );
  }
  if (row.counts.aiEvents > 0) {
    milestone('ai', row.milestones.latestAiAt, 'Shop used AI', `${row.counts.aiEvents} completions`);
  }

  const supabase = getServiceRoleClient();
  const notesPromise = row.shopId
    ? supabase
        .from('admin_lead_notes')
        .select('id, body, created_at')
        .eq('user_id', row.userId)
        .eq('shop_id', row.shopId)
        .order('created_at', { ascending: false })
        .limit(30)
    : Promise.resolve({ data: [], error: null });

  const [audits, notesResult, messages, tickets, notifications, interests] = await Promise.all([
    row.shopId
      ? supabase
          .from('audit_logs')
          .select('id, action, entity_type, user_id, created_at')
          .eq('shop_id', row.shopId)
          .or(`user_id.eq.${row.userId},user_id.is.null`)
          .order('created_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [], error: null }),
    notesPromise,
    row.shopId
      ? supabase
          .from('admin_whatsapp_messages')
          .select('id, body, status, channel, created_at, error')
          .eq('shop_id', row.shopId)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    row.shopId
      ? supabase
          .from('support_tickets')
          .select('id, subject, status, created_at')
          .eq('shop_id', row.shopId)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    row.shopId
      ? supabase
          .from('notifications')
          .select('id, title, message, created_at')
          .eq('shop_id', row.shopId)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    loadInterests(supabase, row.shopId),
  ]);

  if (audits.error) throw new Error(audits.error.message);
  if (notesResult.error) throw new Error(notesResult.error.message);
  if (messages.error) throw new Error(messages.error.message);
  if (tickets.error) throw new Error(tickets.error.message);
  if (notifications.error) throw new Error(notifications.error.message);

  const auditGroups = new Map<string, { at: string; count: number; actor: 'person' | 'shop' | 'mixed' }>();
  for (const event of audits.data || []) {
    const label = auditLabel(String(event.action), String(event.entity_type));
    const actor = event.user_id === row.userId ? 'person' : 'shop';
    const prev = auditGroups.get(label);
    if (!prev) {
      auditGroups.set(label, { at: event.created_at as string, count: 1, actor });
    } else {
      prev.count += 1;
      prev.actor = prev.actor === actor ? prev.actor : 'mixed';
    }
  }
  for (const [label, group] of auditGroups) {
    const actor =
      group.actor === 'person' ? 'By this account' : group.actor === 'shop' ? 'Shop record, actor not stored' : 'Mixed actors on the shop';
    timeline.push({
      id: `audit:${label}`,
      at: group.at,
      label,
      detail: group.count > 1 ? `${group.count} times in the latest shop actions · ${actor}` : actor,
    });
  }

  const notes: LeadNote[] = (notesResult.data || []).map((note) => ({
    id: note.id as string,
    body: note.body as string,
    createdAt: note.created_at as string,
  }));
  for (const note of notes) {
    timeline.push({ id: `note:${note.id}`, at: note.createdAt, label: 'Founder note', detail: note.body });
  }

  const communications: CommunicationItem[] = [];
  for (const message of messages.data || []) {
    communications.push({
      id: message.id as string,
      at: message.created_at as string,
      channel: 'WhatsApp',
      summary: String(message.body || ''),
      status: message.error ? `failed · ${message.error}` : `${message.status} · ${message.channel}`,
    });
    timeline.push({
      id: `wa:${message.id}`,
      at: message.created_at as string,
      label: 'Founder WhatsApp',
      detail: String(message.body || ''),
    });
  }
  for (const note of notes) {
    communications.push({
      id: note.id,
      at: note.createdAt,
      channel: 'Note',
      summary: note.body,
      status: null,
    });
  }
  for (const ticket of tickets.data || []) {
    communications.push({
      id: ticket.id as string,
      at: ticket.created_at as string,
      channel: 'Support',
      summary: ticket.subject as string,
      status: ticket.status as string,
    });
  }
  for (const notification of notifications.data || []) {
    communications.push({
      id: notification.id as string,
      at: (notification.created_at as string) || row.joinedAt,
      channel: 'In-app',
      summary: `${notification.title}: ${notification.message}`,
      status: null,
    });
  }
  communications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { row, timeline, interests, communications, notes };
}

function signInDetail(row: LeadRow): string {
  const method = row.provider === 'google' ? 'Google' : row.provider === 'email' ? 'Email' : row.provider;
  return method ? `Sign-in method: ${method}. Campaign source is not recorded.` : 'Campaign source is not recorded.';
}

async function loadInterests(supabase: SupabaseClient, shopId: string | null): Promise<CatalogueInterest[]> {
  if (!shopId) return [];
  const { data, error } = await supabase
    .from('catalogue_analytics')
    .select('product_id')
    .eq('shop_id', shopId)
    .eq('view_type', 'product_view')
    .not('product_id', 'is', null)
    .limit(500);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const view of data || []) {
    const productId = view.product_id as string;
    counts.set(productId, (counts.get(productId) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return [];
  const { data: products, error: productError } = await supabase
    .from('catalogue_products')
    .select('id, name')
    .in(
      'id',
      top.map(([id]) => id)
    );
  if (productError) throw new Error(productError.message);
  const names = new Map((products || []).map((product) => [product.id as string, product.name as string]));
  return top.map(([productId, views]) => ({
    productId,
    name: names.get(productId) || 'Removed product',
    views,
  }));
}

async function assertMembership(userId: string, shopId: string) {
  const { data, error } = await getServiceRoleClient()
    .from('user_shop_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('That person is not on this shop');
  return data.id as string;
}

export async function saveLead(input: {
  userId: string;
  shopId: string;
  membershipId: string;
  status: string;
  ownerName: string;
  followUpLocal: string;
  note: string;
}) {
  await requireAdminPermission('manage_users');
  if (!isUuid(input.userId) || !isUuid(input.shopId)) throw new Error('Unknown lead');
  if (!isStoredPipeline(input.status)) throw new Error('Choose a lead status');
  const owner = input.ownerName.trim();
  if (owner.length > 80) throw new Error('Owner name is too long');
  const note = input.note.trim();
  if (note.length > 2000) throw new Error('Note is too long');
  const followUp = fromDatetimeLocalIst(input.followUpLocal);
  const membershipId = await assertMembership(input.userId, input.shopId);

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('admin_lead_records').upsert(
    {
      user_id: input.userId,
      shop_id: input.shopId,
      status: input.status,
      owner_name: owner || null,
      follow_up_at: followUp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,shop_id' }
  );
  if (error) throw new Error(error.message);

  if (note) {
    const { error: noteError } = await supabase.from('admin_lead_notes').insert({
      user_id: input.userId,
      shop_id: input.shopId,
      body: note,
    });
    if (noteError) throw new Error(noteError.message);
  }

  await logAdminAction(
    'lead_updated',
    'user',
    input.userId,
    {
      shopId: input.shopId,
      status: input.status,
      ownerName: owner || null,
      followUpAt: followUp,
      noteAdded: Boolean(note),
    },
    `Updated lead to ${input.status}`
  );

  revalidatePath('/leads');
  revalidatePath(`/leads/${membershipId}`);
  revalidatePath(`/leads/${input.membershipId}`);
}

export async function sendLeadWhatsApp(input: {
  userId: string;
  shopId: string;
  membershipId: string;
  message: string;
  mode?: 'auto' | 'session' | 'template';
}) {
  await requireAdminPermission('manage_users');
  if (!isUuid(input.userId) || !isUuid(input.shopId)) throw new Error('Unknown lead');
  const message = input.message.trim();
  if (!message) throw new Error('Write a message first');
  const membershipId = await assertMembership(input.userId, input.shopId);
  const result = await sendWhatsAppToShop({
    shopId: input.shopId,
    message,
    mode: input.mode || 'session',
  });

  if (result.sent) {
    const supabase = getServiceRoleClient();
    const { data: existing } = await supabase
      .from('admin_lead_records')
      .select('status')
      .eq('user_id', input.userId)
      .eq('shop_id', input.shopId)
      .maybeSingle();
    const status = existing?.status as string | undefined;
    if (!status || status === 'new') {
      const { error } = await supabase.from('admin_lead_records').upsert(
        {
          user_id: input.userId,
          shop_id: input.shopId,
          status: 'contacted',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,shop_id' }
      );
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath('/leads');
  revalidatePath(`/leads/${membershipId}`);
  revalidatePath(`/leads/${input.membershipId}`);
  return {
    sent: result.sent,
    error: result.error,
    shopName: result.shopName,
    note: result.note,
    maskedPhone: result.maskedPhone,
  };
}
