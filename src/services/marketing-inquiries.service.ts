'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/admin-ids';
import {
  isInquiryStatus,
  type InquiryInterest,
  type InquiryStatus,
} from '@/lib/marketing-inquiries';
import { ilikeAny } from '@/lib/postgrest-filter';
import { logAdminAction, requireAdminPermission, requireSuperAdmin } from './admin-auth.service';

const PAGE_SIZE = 40;

export type MarketingInquiry = {
  id: string;
  sessionId: string;
  name: string | null;
  shopName: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  shopType: string | null;
  branches: number | null;
  currentTool: string | null;
  interest: InquiryInterest;
  consent: boolean;
  pagePath: string | null;
  status: InquiryStatus;
  notes: string | null;
  assignedTo: string | null;
  followUpOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InquiryListFilters = {
  q?: string;
  status?: string;
  interest?: string;
  assigned?: string;
  due?: string;
  page?: string;
};

export type InquiryOverview = {
  total: number;
  newCount: number;
  contacted: number;
  demoScheduled: number;
  converted: number;
  lost: number;
  dueToday: number;
};

type DbRow = {
  id: string;
  session_id: string;
  name: string | null;
  shop_name: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  shop_type: string | null;
  branches: number | null;
  current_tool: string | null;
  interest: string;
  consent: boolean;
  page_path: string | null;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  follow_up_on: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): MarketingInquiry {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    shopName: row.shop_name,
    phone: row.phone,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    shopType: row.shop_type,
    branches: row.branches,
    currentTool: row.current_tool,
    interest: row.interest as InquiryInterest,
    consent: row.consent,
    pagePath: row.page_path,
    status: row.status as InquiryStatus,
    notes: row.notes,
    assignedTo: row.assigned_to,
    followUpOn: row.follow_up_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function istTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export async function listMarketingInquiries(filters: InquiryListFilters = {}): Promise<{
  rows: MarketingInquiry[];
  total: number;
  page: number;
  pageSize: number;
  overview: InquiryOverview;
  assignees: string[];
}> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('marketing_inquiries')
    .select(
      'id, session_id, name, shop_name, phone, city, state, pin_code, shop_type, branches, current_tool, interest, consent, page_path, status, notes, assigned_to, follow_up_on, created_at, updated_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  const q = filters.q?.trim();
  if (q) {
    const filter = ilikeAny(['name', 'shop_name', 'phone', 'city', 'state'], q);
    if (filter) query = query.or(filter);
  }
  if (filters.status && isInquiryStatus(filters.status)) {
    query = query.eq('status', filters.status);
  }
  if (filters.interest) {
    query = query.eq('interest', filters.interest);
  }
  if (filters.assigned === '__unassigned') {
    query = query.is('assigned_to', null);
  } else if (filters.assigned) {
    query = query.eq('assigned_to', filters.assigned);
  }
  if (filters.due === '1') {
    query = query
      .lte('follow_up_on', istTodayYmd())
      .not('status', 'in', '(converted,lost)')
      .not('follow_up_on', 'is', null);
  }

  const requested = Number(filters.page) || 1;
  const page = Math.max(1, requested);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const today = istTodayYmd();

  const countByStatus = (status: string) =>
    supabase
      .from('marketing_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

  const [
    { data, error, count },
    totalRes,
    newRes,
    contactedRes,
    demoRes,
    convertedRes,
    lostRes,
    dueRes,
    assigneeResult,
  ] = await Promise.all([
    query.range(from, to),
    supabase.from('marketing_inquiries').select('id', { count: 'exact', head: true }),
    countByStatus('new'),
    countByStatus('contacted'),
    countByStatus('demo_scheduled'),
    countByStatus('converted'),
    countByStatus('lost'),
    supabase
      .from('marketing_inquiries')
      .select('id', { count: 'exact', head: true })
      .lte('follow_up_on', today)
      .not('status', 'in', '(converted,lost)')
      .not('follow_up_on', 'is', null),
    supabase
      .from('marketing_inquiries')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .order('assigned_to')
      .limit(500),
  ]);

  if (error) throw new Error(error.message);
  for (const result of [
    totalRes,
    newRes,
    contactedRes,
    demoRes,
    convertedRes,
    lostRes,
    dueRes,
    assigneeResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const overview: InquiryOverview = {
    total: totalRes.count ?? 0,
    newCount: newRes.count ?? 0,
    contacted: contactedRes.count ?? 0,
    demoScheduled: demoRes.count ?? 0,
    converted: convertedRes.count ?? 0,
    lost: lostRes.count ?? 0,
    dueToday: dueRes.count ?? 0,
  };

  const assignees = [
    ...new Set(
      ((assigneeResult.data || []) as { assigned_to: string | null }[])
        .map((row) => row.assigned_to)
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  return {
    rows: ((data || []) as DbRow[]).map(mapRow),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    overview,
    assignees,
  };
}

export async function getMarketingInquiry(id: string): Promise<MarketingInquiry | null> {
  await requireSuperAdmin();
  if (!isUuid(id)) return null;
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('marketing_inquiries')
    .select(
      'id, session_id, name, shop_name, phone, city, state, pin_code, shop_type, branches, current_tool, interest, consent, page_path, status, notes, assigned_to, follow_up_on, created_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as DbRow);
}

export async function saveMarketingInquiry(input: {
  id: string;
  status: string;
  assignedTo: string;
  followUpOn: string;
  notes: string;
}) {
  const admin = await requireAdminPermission('manage_users');
  if (!isUuid(input.id)) throw new Error('Unknown inquiry');
  if (!isInquiryStatus(input.status)) throw new Error('Choose a valid status');

  const assignedTo = input.assignedTo.trim();
  if (assignedTo.length > 80) throw new Error('Assignee name is too long');

  const notes = input.notes.trim();
  if (notes.length > 4000) throw new Error('Notes are too long');

  const followRaw = input.followUpOn.trim();
  let followUpOn: string | null = null;
  if (followRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(followRaw)) throw new Error('Follow-up date is invalid');
    followUpOn = followRaw;
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from('marketing_inquiries')
    .update({
      status: input.status,
      assigned_to: assignedTo || null,
      follow_up_on: followUpOn,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id);

  if (error) throw new Error(error.message);

  await logAdminAction(
    'marketing_inquiry_updated',
    'marketing_inquiry',
    input.id,
    {
      status: input.status,
      assignedTo: assignedTo || null,
      followUpOn,
      actor: admin.email || admin.id,
    },
    `Updated marketing inquiry to ${input.status}`
  );

  revalidatePath('/leads/inquiries');
  revalidatePath(`/leads/inquiries/${input.id}`);
}
