'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import {
  chooseAgentPlay,
  messageForShop,
  playMoved,
  sendGate,
  silenceAfterSend,
  templateForPlay,
  type AgentPlayId,
} from '@/lib/agent-plays';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp/phone';
import { logAdminAction, requireSuperAdmin, assertAdminPermission } from './admin-auth.service';
import { getActivationSnapshot } from './onboarding.service';
import { sendWhatsAppToShop } from './whatsapp-outreach.service';

export type AgentQueueRow = {
  shopId: string;
  shopName: string;
  phone: string | null;
  play: AgentPlayId;
  reason: string;
  question: string;
  /** Meta template for cold ask; null when the next message is a session follow-up. */
  templateName: string | null;
  gate: 'ready' | 'recent' | 'capped' | 'silent' | 'no_phone' | 'opted_out' | 'escalated';
  lastReply: string | null;
  outcome: string | null;
  invoices: number;
  whatsappConnected: boolean;
  upgradeReady: boolean;
};

export async function getAgentQueue(): Promise<AgentQueueRow[]> {
  await requireSuperAdmin();
  const snapshot = await getActivationSnapshot();
  const shopIds = snapshot.shops.map((shop) => shop.shopId);
  const supabase = getServiceRoleClient();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();

  const [stateRes, sendsRes] = await Promise.all([
    shopIds.length
      ? supabase
          .from('admin_agent_shops')
          .select(
            'shop_id, opted_out, escalated, last_reply, last_reply_at, last_play, last_sent_at, baseline_invoices, baseline_whatsapp, baseline_upgrade, unanswered, silence_until, outcome'
          )
          .in('shop_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
    shopIds.length
      ? supabase
          .from('admin_whatsapp_messages')
          .select('shop_id, created_at')
          .eq('source', 'agent')
          .eq('status', 'sent')
          .gte('created_at', since)
          .in('shop_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const state = new Map(
    (stateRes.data || []).map((row) => [
      row.shop_id as string,
      {
        optedOut: Boolean(row.opted_out),
        escalated: Boolean(row.escalated),
        lastReply: (row.last_reply as string | null) ?? null,
        lastReplyAt: (row.last_reply_at as string | null) ?? null,
        lastPlay: (row.last_play as AgentPlayId | null) ?? null,
        lastSentAt: (row.last_sent_at as string | null) ?? null,
        baselineInvoices: row.baseline_invoices as number | null,
        baselineWhatsapp: row.baseline_whatsapp as boolean | null,
        baselineUpgrade: row.baseline_upgrade as boolean | null,
        unanswered: Number(row.unanswered ?? 0),
        silenceUntil: (row.silence_until as string | null) ?? null,
        outcome: (row.outcome as string | null) ?? null,
      },
    ])
  );
  const sentAt = new Map<string, string[]>();
  for (const row of sendsRes.data || []) {
    const id = row.shop_id as string;
    const list = sentAt.get(id) || [];
    list.push(row.created_at as string);
    sentAt.set(id, list);
  }

  const rows: AgentQueueRow[] = [];
  const outcomeWrites: { shop_id: string; outcome: string }[] = [];
  for (const shop of snapshot.shops) {
    const play = chooseAgentPlay(shop);
    const memory = state.get(shop.shopId);
    if (
      memory?.lastPlay &&
      memory.lastSentAt &&
      !memory.outcome &&
      Date.now() - new Date(memory.lastSentAt).getTime() >= 7 * 86400000
    ) {
      const moved = playMoved(
        memory.lastPlay,
        {
          invoices: memory.baselineInvoices ?? 0,
          whatsapp: Boolean(memory.baselineWhatsapp),
          upgradeReady: Boolean(memory.baselineUpgrade),
          quiet: true,
        },
        {
          invoices: shop.counts.invoices,
          whatsapp: shop.counts.whatsappConnected,
          upgradeReady: shop.upgradeReady,
          quiet: shop.primary === 'quiet',
        }
      );
      const outcome = moved ? 'moved' : 'unchanged';
      memory.outcome = outcome;
      outcomeWrites.push({ shop_id: shop.shopId, outcome });
    }
    if (!play) continue;
    const times = sentAt.get(shop.shopId) || [];
    const lastSent = memory?.lastSentAt ? new Date(memory.lastSentAt).getTime() : 0;
    const replyAt = memory?.lastReplyAt ? new Date(memory.lastReplyAt).getTime() : 0;
    const repliedAfterLastSend = Boolean(lastSent && replyAt > lastSent);
    let gate: AgentQueueRow['gate'] = sendGate({
      sentAt: times,
      silenceUntil: memory?.silenceUntil,
      repliedAfterLastSend,
    });
    if (!normalizeWhatsAppPhone(shop.phone)) gate = 'no_phone';
    if (memory?.optedOut) gate = 'opted_out';
    if (memory?.escalated) gate = 'escalated';
    rows.push({
      shopId: shop.shopId,
      shopName: shop.shopName,
      phone: shop.phone,
      play: play.id,
      reason: play.reason,
      question: messageForShop(play, memory?.lastReply ?? null, repliedAfterLastSend),
      templateName: repliedAfterLastSend ? null : templateForPlay(play.id),
      gate,
      lastReply: memory?.lastReply ?? null,
      outcome: memory?.outcome ?? null,
      invoices: shop.counts.invoices,
      whatsappConnected: shop.counts.whatsappConnected,
      upgradeReady: shop.upgradeReady,
    });
  }
  if (outcomeWrites.length > 0) {
    await Promise.all(
      outcomeWrites.map((row) =>
        supabase
          .from('admin_agent_shops')
          .update({ outcome: row.outcome, updated_at: new Date().toISOString() })
          .eq('shop_id', row.shop_id)
      )
    );
  }

  const order: AgentQueueRow['gate'][] = [
    'ready',
    'recent',
    'capped',
    'silent',
    'escalated',
    'no_phone',
    'opted_out',
  ];
  rows.sort((a, b) => order.indexOf(a.gate) - order.indexOf(b.gate) || a.shopName.localeCompare(b.shopName));
  return rows;
}

async function upsertState(
  shopId: string,
  patch: Record<string, unknown>
) {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('admin_agent_shops').upsert(
    {
      shop_id: shopId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_id' }
  );
  if (error) throw new Error(error.message);
}

export async function approveAgentSend(shopId: string) {
  await assertAdminPermission('manage_shops');
  const queue = await getAgentQueue();
  const row = queue.find((item) => item.shopId === shopId);
  if (!row) throw new Error('This shop has no play right now');
  if (row.gate !== 'ready') throw new Error('This shop is not ready for another message');

  // Cold ask = approved Meta template (shop name + Visit Website). Reply-shaped follow-up = session.
  const useTemplate = Boolean(row.templateName);
  const result = await sendWhatsAppToShop({
    shopId,
    message: row.question,
    mode: useTemplate ? 'template' : 'session',
    templateName: row.templateName ?? undefined,
    source: 'agent',
  });
  if (!result.sent) throw new Error(result.error || 'WhatsApp was not accepted');

  const previous = await getServiceRoleClient()
    .from('admin_agent_shops')
    .select('unanswered, last_sent_at, last_reply_at')
    .eq('shop_id', shopId)
    .maybeSingle();
  const lastSent = previous.data?.last_sent_at ? new Date(previous.data.last_sent_at).getTime() : 0;
  const replyAt = previous.data?.last_reply_at ? new Date(previous.data.last_reply_at).getTime() : 0;
  const silence = silenceAfterSend(
    Number(previous.data?.unanswered ?? 0),
    Boolean(lastSent && replyAt > lastSent)
  );
  await upsertState(shopId, {
    last_play: row.play,
    escalated: false,
    last_sent_at: new Date().toISOString(),
    baseline_invoices: row.invoices,
    baseline_whatsapp: row.whatsappConnected,
    baseline_upgrade: row.upgradeReady,
    unanswered: silence.unanswered,
    silence_until: silence.silenceUntil,
    outcome: null,
  });
  await logAdminAction(
    'agent_play_sent',
    'shop',
    shopId,
    { play: row.play, shopName: row.shopName },
    `Agent asked: ${row.play}`
  );
  revalidatePath('/agent');
  return { note: result.note };
}

export async function setAgentOptOut(shopId: string, optedOut: boolean) {
  await assertAdminPermission('manage_shops');
  await upsertState(shopId, { opted_out: optedOut });
  await logAdminAction(
    optedOut ? 'agent_opt_out' : 'agent_opt_in',
    'shop',
    shopId,
    {},
    optedOut ? 'Shop opted out of the agent' : 'Shop opted back into the agent'
  );
  revalidatePath('/agent');
}

export async function setAgentEscalation(shopId: string, escalated: boolean) {
  await assertAdminPermission('manage_shops');
  await upsertState(shopId, { escalated });
  revalidatePath('/agent');
}

export async function saveAgentReply(shopId: string, reply: string) {
  await assertAdminPermission('manage_shops');
  const text = reply.trim();
  if (!text) throw new Error('Write what they replied');
  if (text.length > 500) throw new Error('Reply is too long');
  const stopped = /^(stop|unsubscribe|band karo|mat bhejo)$/i.test(text);
  await upsertState(shopId, {
    last_reply: text,
    last_reply_at: new Date().toISOString(),
    unanswered: 0,
    silence_until: null,
    ...(stopped ? { opted_out: true } : {}),
  });
  revalidatePath('/agent');
}
