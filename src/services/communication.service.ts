'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { authActorId } from '@/lib/admin-ids';
import { requireSuperAdmin, logAdminAction } from './admin-auth.service';
import { fanOutShopNotifications } from './shop-inbox.service';

interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface Notification {
  shopId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  actionUrl?: string;
  expiresAt?: string;
}

interface SupportTicket {
  shopId: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category?: string;
}

const EMAIL_NOT_CONFIGURED =
  'Email delivery is not configured. Use WhatsApp, mailto, or the shop in-app inbox.';

/**
 * No email provider is wired. Do not claim mail was sent.
 */
export async function sendEmailToShops(shopIds: string[], message: EmailMessage) {
  await requireSuperAdmin();
  return {
    success: false as const,
    sentCount: 0,
    recipients: [] as string[],
    skipped: true as const,
    reason: EMAIL_NOT_CONFIGURED,
    requested: shopIds.length,
    subject: message.subject,
  };
}

/**
 * Fan-out into public.notifications — the shop Notification Center inbox.
 */
export async function sendNotificationToShops(shopIds: string[], notification: Notification) {
  await requireSuperAdmin();
  const sentCount = await fanOutShopNotifications({
    shopIds,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    link: notification.actionUrl ?? null,
  });

  await logAdminAction(
    'notification_sent',
    'shop',
    shopIds.length === 1 ? shopIds[0] : null,
    {
      recipients: shopIds,
      title: notification.title,
      type: notification.type,
      sentCount,
    },
    `Sent ${notification.type} inbox notice to ${sentCount} shops`
  );

  return {
    success: true as const,
    sentCount,
  };
}

/**
 * Broadcast to active shops. Inbox writes are real; email is not sent.
 */
export async function broadcastMessage(message: {
  title: string;
  body: string;
  type: 'email' | 'notification' | 'both';
  priority: 'normal' | 'high';
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, email')
    .eq('is_active', true)
    .or('is_suspended.eq.false,is_suspended.is.null');

  if (error) throw error;
  if (!shops || shops.length === 0) {
    throw new Error('No active shops found');
  }

  const shopIds = shops.map((s) => s.id);
  const results: {
    email?: Awaited<ReturnType<typeof sendEmailToShops>>;
    notification?: Awaited<ReturnType<typeof sendNotificationToShops>>;
  } = {};

  if (message.type === 'email' || message.type === 'both') {
    results.email = await sendEmailToShops(shopIds, {
      to: shops.filter((s) => s.email).map((s) => s.email!),
      subject: message.title,
      body: message.body,
      isHtml: true,
    });
  }

  if (message.type === 'notification' || message.type === 'both') {
    results.notification = await sendNotificationToShops(shopIds, {
      shopId: '',
      title: message.title,
      message: message.body,
      type: message.priority === 'high' ? 'warning' : 'info',
    });
  }

  const inboxSent = results.notification?.sentCount ?? 0;
  return {
    success: inboxSent > 0 || message.type === 'notification',
    totalShops: shopIds.length,
    inboxSent,
    emailSkipped: Boolean(results.email?.skipped),
    results,
  };
}

/**
 * Create support ticket (admin-initiated on behalf of a shop)
 */
export async function createSupportTicket(ticket: Omit<SupportTicket, 'status'>) {
  const admin = await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      shop_id: ticket.shopId,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: 'open',
      category: ticket.category || null,
      created_by: authActorId(admin),
    })
    .select()
    .single();

  if (error) throw error;

  await logAdminAction(
    'support_ticket_created',
    'support',
    data.id,
    {
      shopId: ticket.shopId,
      priority: ticket.priority,
      subject: ticket.subject,
    },
    `Created ${ticket.priority} priority support ticket`
  );

  return data;
}

/**
 * Get all support tickets
 */
export async function getAllSupportTickets(filters?: {
  status?: string;
  priority?: string;
  shopId?: string;
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('support_tickets')
    .select(`
      *,
      shop:shops(id, shop_name, email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.shopId) {
    query = query.eq('shop_id', filters.shopId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

/**
 * Update support ticket status
 */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
  resolution?: string
) {
  const admin = await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const updates: Record<string, string | null> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = authActorId(admin);
    if (resolution) {
      updates.resolution = resolution;
    }
  }

  const { error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId);

  if (error) throw error;

  await logAdminAction(
    'support_ticket_updated',
    'support',
    ticketId,
    { status, resolution },
    `Updated ticket status to ${status}`
  );
}

/**
 * Get communication history for a shop
 */
export async function getShopCommunicationHistory(shopId: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const [notifications, tickets] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, title, message, type, link, read, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('support_tickets')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    emails: [] as const,
    notifications: notifications.data || [],
    tickets: tickets.data || [],
  };
}
