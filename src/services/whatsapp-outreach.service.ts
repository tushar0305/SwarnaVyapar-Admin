'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { logAdminAction, requireSuperAdmin, assertAdminPermission } from './admin-auth.service';
import {
  ensureOpsTemplate,
  getWhatsAppConfig,
  getWhatsAppConfigHealth,
  listWhatsAppTemplates,
  pickSendTemplate,
  sendWhatsAppSessionText,
  sendWhatsAppTemplate,
  testWhatsAppNumber,
  toSendableTemplate,
  type SendableTemplate,
} from '@/lib/whatsapp/cloud';
import { maskPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp/phone';

export type WhatsAppStatus = {
  ready: boolean;
  missing: string[];
  connected: boolean;
  displayName: string | null;
  displayPhone: string | null;
  templateName: string;
  templateStatus: string | null;
  templateCategory: string | null;
  templates: Array<{ name: string; status: string; language: string; category?: string }>;
  error: string | null;
};

export type WhatsAppSendResult = {
  shopId: string;
  shopName: string;
  phone: string;
  maskedPhone: string;
  sent: boolean;
  channel: 'template' | 'session' | null;
  templateName: string | null;
  templateCategory: string | null;
  messageId: string | null;
  error: string | null;
  note: string | null;
};

const COHORT_COPY: Record<string, string> = {
  never_started: 'Your SwarnaVyapar shop is ready. Add a customer and create the first invoice.',
  stalled_billing: 'You already have stock or customers. Create the first bill from the counter.',
  quiet: 'It has been a while since the last invoice. Open Billing to get back into the daily rhythm.',
  upgrade_ready: 'You are close to a free-plan cap. Review Plans if you need more room.',
  whatsapp_off: 'Connect WhatsApp in the app so invoices and reminders go out from the counter.',
  needs_help: 'Need a hand getting started? Finish GST, a customer, stock, then the first invoice.',
};

function defaultInstruction(cohort?: string) {
  return COHORT_COPY[cohort || ''] || COHORT_COPY.needs_help;
}

function emptySendResult(
  partial: Partial<WhatsAppSendResult> & Pick<WhatsAppSendResult, 'shopId' | 'shopName' | 'phone'>
): WhatsAppSendResult {
  return {
    maskedPhone: maskPhone(partial.phone),
    sent: false,
    channel: null,
    templateName: null,
    templateCategory: null,
    messageId: null,
    error: null,
    note: null,
    ...partial,
  };
}

async function loadStatus(): Promise<WhatsAppStatus> {
  const health = getWhatsAppConfigHealth();
  const config = getWhatsAppConfig();
  if (!config) {
    return {
      ready: false,
      missing: health.missing,
      connected: false,
      displayName: health.businessName,
      displayPhone: health.displayPhone,
      templateName: health.templateName,
      templateStatus: null,
      templateCategory: null,
      templates: [],
      error: health.missing.length
        ? `Set ${health.missing.join(', ')} in .env.local`
        : 'WhatsApp is not configured',
    };
  }

  const [live, templates] = await Promise.all([
    testWhatsAppNumber(config),
    listWhatsAppTemplates(config),
  ]);
  const ops = pickSendTemplate(templates.templates, config.templateName);
  const marketingWarning =
    ops?.status === 'APPROVED' && ops.category === 'MARKETING'
      ? `Template ${ops.name} is MARKETING. Meta may accept the send while the phone never shows it. Submit the utility template ${config.templateName === ops.name ? '' : config.templateName + ' '}and wait for APPROVED.`
      : null;

  return {
    ready: true,
    missing: [],
    connected: live.success,
    displayName: live.success ? live.displayName || config.businessName : config.businessName,
    displayPhone: live.success ? live.displayPhone || config.displayPhone : config.displayPhone,
    templateName: ops?.name || config.templateName,
    templateStatus: ops?.status ?? null,
    templateCategory: ops?.category ?? null,
    templates: templates.templates.slice(0, 40),
    error: live.success ? templates.error || marketingWarning : live.error,
  };
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  await requireSuperAdmin();
  return loadStatus();
}

export async function testWhatsAppConnection(): Promise<WhatsAppStatus> {
  await requireSuperAdmin();
  const status = await loadStatus();
  await logAdminAction(
    'whatsapp_connection_tested',
    'whatsapp',
    null,
    { connected: status.connected, templateStatus: status.templateStatus },
    status.connected ? 'WhatsApp Cloud API reachable' : status.error || 'WhatsApp test failed'
  );
  return status;
}

export async function provisionOpsTemplate(): Promise<WhatsAppStatus> {
  await requireSuperAdmin();
  const config = getWhatsAppConfig();
  if (!config) return loadStatus();
  const result = await ensureOpsTemplate(config);
  await logAdminAction(
    'whatsapp_template_provisioned',
    'whatsapp',
    null,
    { name: result.name, status: result.status, created: result.created },
    result.error || `Ops template ${result.name} is ${result.status}`
  );
  revalidatePath('/whatsapp');
  revalidatePath('/settings');
  return loadStatus();
}

export async function listWhatsAppShops() {
  await requireSuperAdmin();
  const { data, error } = await getServiceRoleClient()
    .from('shops')
    .select('id, shop_name, phone_number, email')
    .eq('is_active', true)
    .order('shop_name');
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.shop_name as string,
    phone: row.phone_number as string | null,
    email: row.email as string | null,
    reachable: Boolean(normalizeWhatsAppPhone(row.phone_number)),
  }));
}

/** Approved Meta templates with body/header/button variables parsed for the composer. */
export async function listSendableWhatsAppTemplates(): Promise<{
  templates: SendableTemplate[];
  error: string | null;
}> {
  await requireSuperAdmin();
  const config = getWhatsAppConfig();
  if (!config) return { templates: [], error: 'WhatsApp Cloud API is not configured' };
  const listed = await listWhatsAppTemplates(config);
  if (listed.error) return { templates: [], error: listed.error };
  const categoryRank = (category?: string) => {
    const value = (category || '').toUpperCase();
    if (value === 'UTILITY') return 0;
    if (value === 'AUTHENTICATION') return 1;
    if (value === 'MARKETING') return 2;
    return 3;
  };
  const templates = listed.templates
    .filter((row) => row.status === 'APPROVED')
    .map(toSendableTemplate)
    .sort((a, b) => {
      const byCategory = categoryRank(a.category) - categoryRank(b.category);
      if (byCategory !== 0) return byCategory;
      const aAdmin = a.name.startsWith('sv_admin_') ? 0 : 1;
      const bAdmin = b.name.startsWith('sv_admin_') ? 0 : 1;
      return aAdmin - bAdmin || a.name.localeCompare(b.name) || a.language.localeCompare(b.language);
    });
  return { templates, error: null };
}

export async function getRecentWhatsAppSends(limit = 30) {
  await requireSuperAdmin();
  const { data, error } = await getServiceRoleClient()
    .from('admin_whatsapp_messages')
    .select('id, shop_id, to_phone, body, template_name, channel, status, error, meta_message_id, created_at, shop:shops(shop_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => {
    const shop = Array.isArray(row.shop) ? row.shop[0] : row.shop;
    return {
      id: row.id as string,
      shopId: (row.shop_id as string | null) ?? null,
      shopName: (shop as { shop_name?: string } | null)?.shop_name || 'Unknown shop',
      phone: maskPhone(row.to_phone as string),
      body: row.body as string,
      templateName: (row.template_name as string | null) ?? null,
      channel: row.channel as string,
      status: row.status as string,
      error: (row.error as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

async function recentlySent(shopId: string) {
  const since = new Date(Date.now() - 20_000).toISOString();
  const { count } = await getServiceRoleClient()
    .from('admin_whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('status', 'sent')
    .gte('created_at', since);
  return (count || 0) > 0;
}

async function recordSend(input: {
  shopId: string;
  phone: string;
  body: string;
  templateName: string | null;
  channel: 'template' | 'session';
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
  source?: string;
}) {
  await getServiceRoleClient().from('admin_whatsapp_messages').insert({
    shop_id: input.shopId,
    to_phone: input.phone,
    body: input.body,
    template_name: input.templateName,
    channel: input.channel,
    meta_message_id: input.messageId ?? null,
    status: input.status,
    error: input.error ?? null,
    source: input.source ?? null,
  });
}

function sessionWindowError(error?: string, errorCode?: number): string {
  if (errorCode === 131047 || /24.?hour|re-engagement|outside.*window/i.test(error || '')) {
    return 'Free text only works if this number messaged SwarnaVyapar WhatsApp in the last 24 hours. Outside that window Meta requires an approved template.';
  }
  return error || 'WhatsApp session send failed';
}

function sessionBody(shopName: string, message: string) {
  return `Hello ${shopName}, this is SwarnaVyapar.\n\n${message}\n\nReply here if you need help.`;
}

export async function sendWhatsAppToShop(input: {
  shopId: string;
  message?: string;
  cohort?: string;
  /** Free text skips templates. Meta only allows it inside the 24h customer window. */
  mode?: 'auto' | 'session' | 'template';
  /** Override which approved template to send (defaults to WHATSAPP_OPS_TEMPLATE). */
  templateName?: string;
  templateLanguage?: string;
  /** Explicit {{n}} values from the composer. When set, used instead of shop-name default. */
  bodyParams?: string[];
  headerParams?: string[];
  buttonParams?: Array<{ index: number; text: string }>;
  source?: string;
}): Promise<WhatsAppSendResult> {
  await assertAdminPermission('manage_shops');
  const config = getWhatsAppConfig();
  if (!config) {
    throw new Error('WhatsApp Cloud API is not configured. Add the token, phone number ID, and WABA ID.');
  }

  const mode = input.mode || 'auto';
  const preferredTemplate = input.templateName?.trim() || config.templateName;
  const preferredLanguage = input.templateLanguage?.trim() || 'en';
  const hasExplicitParams =
    input.bodyParams !== undefined ||
    input.headerParams !== undefined ||
    input.buttonParams !== undefined;
  const message = (input.message?.trim() || defaultInstruction(input.cohort)).slice(0, 900);

  if (process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_DEBUG === '1') {
    console.log('\n[whatsapp:debug] sendWhatsAppToShop input', JSON.stringify({
      shopId: input.shopId,
      mode,
      preferredTemplate,
      preferredLanguage,
      hasExplicitParams,
      bodyParams: input.bodyParams ?? null,
      headerParams: input.headerParams ?? null,
      buttonParams: input.buttonParams ?? null,
      message,
      cohort: input.cohort ?? null,
      source: input.source ?? null,
      phoneNumberId: config.phoneNumberId,
      wabaId: config.wabaId,
      displayPhone: config.displayPhone,
    }, null, 2));
  }
  const { data: shop, error } = await getServiceRoleClient()
    .from('shops')
    .select('id, shop_name, phone_number')
    .eq('id', input.shopId)
    .maybeSingle();
  if (error || !shop) throw new Error('Shop not found');

  const phone = normalizeWhatsAppPhone(shop.phone_number);
  if (!phone) {
    return emptySendResult({
      shopId: shop.id,
      shopName: shop.shop_name,
      phone: shop.phone_number || '',
      error: 'This shop has no valid WhatsApp number',
    });
  }

  if (await recentlySent(shop.id)) {
    return emptySendResult({
      shopId: shop.id,
      shopName: shop.shop_name,
      phone,
      error: 'Wait a few seconds before sending again to this shop',
    });
  }

  let templateName: string | null = null;
  let templateCategory: string | null = null;
  let templateLanguage: string | null = null;
  let channel: 'template' | 'session' = 'session';
  let result: { success: boolean; messageId?: string; error?: string; errorCode?: number };

  if (mode === 'session') {
    result = await sendWhatsAppSessionText({
      config,
      to: phone,
      message: sessionBody(shop.shop_name, message),
    });
    if (!result.success) {
      result = { ...result, error: sessionWindowError(result.error, result.errorCode) };
    }
  } else {
    let listed = await listWhatsAppTemplates(config);
    const selected =
      listed.templates.find(
        (row) =>
          row.name === preferredTemplate &&
          (row.language === preferredLanguage ||
            row.language?.startsWith(preferredLanguage) ||
            preferredLanguage.startsWith(row.language || ''))
      ) || listed.templates.find((row) => row.name === preferredTemplate);

    // Composer-picked template: send exactly that APPROVED row (even MARKETING — UI warns).
    // Agent / auto without an explicit pick: keep preferring non-marketing utility.
    let ops =
      mode === 'template' && input.templateName
        ? selected && selected.status === 'APPROVED'
          ? selected
          : null
        : pickSendTemplate(listed.templates, preferredTemplate);

    if (!ops || ops.status !== 'APPROVED') {
      await ensureOpsTemplate({ ...config, templateName: preferredTemplate });
      listed = await listWhatsAppTemplates(config);
      ops =
        mode === 'template' && input.templateName
          ? listed.templates.find((row) => row.name === preferredTemplate && row.status === 'APPROVED') ||
            null
          : pickSendTemplate(listed.templates, preferredTemplate);
    }

    const canTemplate = ops?.status === 'APPROVED';
    const blockMarketingAuto =
      mode !== 'template' && ops?.category === 'MARKETING' && !input.templateName;
    templateName = ops?.name || preferredTemplate;
    templateCategory = ops?.category || null;
    const language = ops?.language || preferredLanguage;
    templateLanguage = language;

    if (mode === 'template' && (!canTemplate || blockMarketingAuto)) {
      return emptySendResult({
        shopId: shop.id,
        shopName: shop.shop_name,
        phone,
        templateName,
        templateCategory,
        error: `Template ${templateName} is ${ops?.status || 'missing'}. Wait for Meta approval, or send free text if they messaged you in the last 24 hours.`,
      });
    }

    if (canTemplate && !blockMarketingAuto) {
      if (process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_DEBUG === '1') {
        console.log('\n[whatsapp:debug] selected Meta template', JSON.stringify({
          name: ops?.name,
          status: ops?.status,
          language: ops?.language,
          category: ops?.category,
          id: ops?.id,
          components: ops?.components ?? null,
        }, null, 2));
      }
      result = await sendWhatsAppTemplate({
        config,
        to: phone,
        shopName: shop.shop_name,
        message,
        templateName,
        language,
        ...(hasExplicitParams
          ? {
              bodyParams: input.bodyParams ?? [],
              headerParams: input.headerParams ?? [],
              buttonParams: input.buttonParams ?? [],
            }
          : {}),
      });
      channel = 'template';
      if (!result.success && mode === 'auto') {
        result = await sendWhatsAppSessionText({
          config,
          to: phone,
          message: sessionBody(shop.shop_name, message),
        });
        channel = 'session';
        templateName = null;
        templateLanguage = null;
        if (!result.success) {
          result = { ...result, error: sessionWindowError(result.error, result.errorCode) };
        }
      }
    } else {
      result = await sendWhatsAppSessionText({
        config,
        to: phone,
        message: sessionBody(shop.shop_name, message),
      });
      channel = 'session';
      templateName = null;
      templateCategory = null;
      templateLanguage = null;
      if (!result.success) {
        result = { ...result, error: sessionWindowError(result.error, result.errorCode) };
      }
    }
  }

  await recordSend({
    shopId: shop.id,
    phone,
    body: message,
    templateName: channel === 'template' ? templateName : null,
    channel,
    status: result.success ? 'sent' : 'failed',
    messageId: result.messageId,
    error: result.error,
    source: input.source,
  });

  if (process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_DEBUG === '1') {
    console.log('\n[whatsapp:debug] sendWhatsAppToShop result', JSON.stringify({
      shopId: shop.id,
      shopName: shop.shop_name,
      to: phone,
      mode,
      channel,
      templateName: channel === 'template' ? templateName : null,
      templateCategory: channel === 'template' ? templateCategory : null,
      templateLanguage: channel === 'template' ? templateLanguage : null,
      sent: Boolean(result.success),
      messageId: result.messageId ?? null,
      error: result.error ?? null,
      errorCode: result.errorCode ?? null,
      noteHint:
        channel === 'template' && templateCategory === 'MARKETING'
          ? 'MARKETING: Meta accept ≠ phone delivery'
          : channel === 'template'
            ? 'Template accept ≠ delivery receipt'
            : 'Session text only works inside 24h window',
    }, null, 2));
  }

  const note = result.success
    ? channel === 'template' && templateCategory === 'MARKETING'
      ? `Meta accepted a MARKETING template to ${maskPhone(phone)}. That often never appears on the phone. Prefer free text inside the 24h window, or wait for a UTILITY template.`
      : channel === 'template'
        ? `Meta accepted the template to ${maskPhone(phone)}. This is not a delivery receipt.`
        : `Meta accepted free text to ${maskPhone(phone)}. Free text only works inside the 24-hour window.`
    : null;

  await logAdminAction(
    result.success ? 'whatsapp_sent' : 'whatsapp_failed',
    'shop',
    shop.id,
    {
      shopName: shop.shop_name,
      phone: maskPhone(phone),
      channel,
      mode,
      template: channel === 'template' ? templateName : null,
      templateCategory: channel === 'template' ? templateCategory : null,
    },
    result.success
      ? `WhatsApp ${channel} accepted for ${shop.shop_name}`
      : result.error || 'WhatsApp send failed'
  );

  revalidatePath('/whatsapp');
  revalidatePath('/activation');
  revalidatePath('/communications');
  revalidatePath('/leads');
  revalidatePath(`/shops/${shop.id}`);

  return emptySendResult({
    shopId: shop.id,
    shopName: shop.shop_name,
    phone,
    sent: Boolean(result.success),
    channel: result.success ? channel : null,
    templateName: channel === 'template' ? templateName : null,
    templateCategory: channel === 'template' ? templateCategory : null,
    messageId: result.messageId ?? null,
    error: result.success ? null : result.error || 'WhatsApp send failed',
    note,
  });
}

export async function sendWhatsAppToShops(input: {
  shopIds: string[];
  message: string;
}): Promise<{ sent: number; failed: number; results: WhatsAppSendResult[] }> {
  await assertAdminPermission('manage_shops');
  const ids = [...new Set(input.shopIds)].slice(0, 15);
  if (ids.length === 0) throw new Error('Select at least one shop');
  const message = input.message.trim();
  if (!message) throw new Error('Message is required');

  const results: WhatsAppSendResult[] = [];
  for (const shopId of ids) {
    results.push(await sendWhatsAppToShop({ shopId, message }));
  }
  return {
    sent: results.filter((row) => row.sent).length,
    failed: results.filter((row) => !row.sent).length,
    results,
  };
}
