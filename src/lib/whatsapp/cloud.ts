import { normalizeWhatsAppPhone } from './phone';

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/** Current admin Utility templates submitted for Meta review. */
export const OPS_TEMPLATE_NAME = 'sv_admin_setup';
export const ADMIN_TEMPLATES = {
  setup: 'sv_admin_setup',
  quiet: 'sv_admin_quiet',
  account: 'sv_admin_account',
} as const;

export type AdminTemplateKey = keyof typeof ADMIN_TEMPLATES;

/** Older names kept only so we can recognize leftover Meta rows. */
export const LEGACY_OPS_TEMPLATE_NAMES = [
  'sv_shop_help',
  'sv_ops_instruction',
] as const;

export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  businessName: string;
  templateName: string;
};

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const wabaId = process.env.WHATSAPP_WABA_ID?.trim();
  if (!accessToken || !phoneNumberId || !wabaId) return null;
  return {
    accessToken,
    phoneNumberId,
    wabaId,
    displayPhone: process.env.WHATSAPP_DISPLAY_PHONE?.trim() || null,
    businessName: process.env.WHATSAPP_BUSINESS_NAME?.trim() || 'SwarnaVyapar',
    templateName: process.env.WHATSAPP_OPS_TEMPLATE?.trim() || OPS_TEMPLATE_NAME,
  };
}

export function getWhatsAppConfigHealth() {
  const missing: string[] = [];
  if (!process.env.WHATSAPP_ACCESS_TOKEN?.trim()) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!process.env.WHATSAPP_WABA_ID?.trim()) missing.push('WHATSAPP_WABA_ID');
  return {
    ready: missing.length === 0,
    missing,
    templateName: process.env.WHATSAPP_OPS_TEMPLATE?.trim() || OPS_TEMPLATE_NAME,
    businessName: process.env.WHATSAPP_BUSINESS_NAME?.trim() || 'SwarnaVyapar',
    displayPhone: process.env.WHATSAPP_DISPLAY_PHONE?.trim() || null,
  };
}

type MetaError = { error?: { message?: string; code?: number; error_data?: unknown; error_subcode?: number; fbtrace_id?: string; type?: string } };

function whatsappDebugEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_DEBUG === '1';
}

function debugWhatsApp(label: string, detail: unknown) {
  if (!whatsappDebugEnabled()) return;
  console.log(`\n[whatsapp:debug] ${label}`);
  console.log(
    typeof detail === 'string'
      ? detail
      : JSON.stringify(detail, null, 2)
  );
}

async function metaFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T & MetaError }> {
  const method = init?.method || 'GET';
  let parsedBody: unknown = undefined;
  if (typeof init?.body === 'string' && init.body) {
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      parsedBody = init.body;
    }
  }

  if (whatsappDebugEnabled() && path.includes('/messages')) {
    debugWhatsApp('Meta request', {
      method,
      url: `${META_API_BASE}${path}`,
      phoneNumberId: path.split('/')[1],
      body: parsedBody,
    });
  }

  const response = await fetch(`${META_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json()) as T & MetaError;

  if (whatsappDebugEnabled() && path.includes('/messages')) {
    debugWhatsApp('Meta response', {
      httpStatus: response.status,
      ok: response.ok,
      data,
    });
  }

  return { ok: response.ok, status: response.status, data };
}

export async function testWhatsAppNumber(config: WhatsAppConfig) {
  const { ok, data } = await metaFetch<{
    verified_name?: string;
    display_phone_number?: string;
  }>(`/${config.phoneNumberId}?fields=verified_name,display_phone_number`, config.accessToken);
  if (!ok) {
    return {
      success: false as const,
      error: data.error?.message || 'Could not reach the WhatsApp Cloud API',
    };
  }
  return {
    success: true as const,
    displayName: data.verified_name || config.businessName,
    displayPhone: data.display_phone_number || config.displayPhone,
  };
}

export type MetaTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    body_text_named_params?: Array<{ param_name?: string; example?: string }>;
  };
  buttons?: Array<{
    type?: string;
    text?: string;
    url?: string;
    example?: string[];
  }>;
};

export type MetaTemplate = {
  id?: string;
  name: string;
  status: string;
  language: string;
  category?: string;
  components?: MetaTemplateComponent[];
};

export type TemplateVariableField = {
  key: string;
  component: 'header' | 'body' | 'button';
  /** 1-based {{n}} index inside that component */
  index: number;
  /** Button index for URL buttons with a dynamic path suffix */
  buttonIndex?: number;
  label: string;
  example?: string;
  /** Meta OTP / URL button dynamic segment limit is often 15. */
  maxLength?: number;
};

export type SendableTemplate = {
  id?: string;
  name: string;
  status: string;
  language: string;
  category?: string;
  bodyText: string | null;
  headerText: string | null;
  variables: TemplateVariableField[];
};

const VAR_RE = /\{\{(\d+)\}\}/g;

function countNamedSlots(text: string | undefined | null): number {
  if (!text) return 0;
  let max = 0;
  for (const match of text.matchAll(VAR_RE)) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Meta URL button params are only the {{1}} segment, not the full example URL.
 * e.g. template `...code=otp{{1}}` + example `...code=otp123456` → `123456`
 */
export function extractUrlButtonParam(urlTemplate: string | undefined, fullExample?: string): string | undefined {
  if (!urlTemplate) return undefined;
  const marker = urlTemplate.indexOf('{{1}}');
  if (marker < 0) return fullExample;
  const prefix = urlTemplate.slice(0, marker);
  const suffix = urlTemplate.slice(marker + '{{1}}'.length);
  if (fullExample && fullExample.startsWith(prefix) && (!suffix || fullExample.endsWith(suffix))) {
    return fullExample.slice(prefix.length, fullExample.length - suffix.length);
  }
  return undefined;
}

export function parseTemplateVariables(
  components: MetaTemplateComponent[] | undefined
): Pick<SendableTemplate, 'bodyText' | 'headerText' | 'variables'> {
  const variables: TemplateVariableField[] = [];
  let bodyText: string | null = null;
  let headerText: string | null = null;

  for (const component of components || []) {
    const type = (component.type || '').toUpperCase();
    if (type === 'HEADER' && (component.format || 'TEXT').toUpperCase() === 'TEXT') {
      headerText = component.text || null;
      const count = countNamedSlots(component.text);
      const examples = component.example?.header_text || [];
      for (let i = 1; i <= count; i += 1) {
        variables.push({
          key: `header.${i}`,
          component: 'header',
          index: i,
          label: `Header {{${i}}}`,
          example: examples[i - 1],
        });
      }
    }
    if (type === 'BODY') {
      bodyText = component.text || null;
      const count = countNamedSlots(component.text);
      const examples = component.example?.body_text?.[0] || [];
      for (let i = 1; i <= count; i += 1) {
        variables.push({
          key: `body.${i}`,
          component: 'body',
          index: i,
          label: `Body {{${i}}}`,
          example: examples[i - 1],
        });
      }
    }
    if (type === 'BUTTONS') {
      (component.buttons || []).forEach((button, buttonIndex) => {
        if ((button.type || '').toUpperCase() !== 'URL') return;
        const slots = countNamedSlots(button.url);
        if (slots === 0) return;
        const example =
          extractUrlButtonParam(button.url, button.example?.[0]) ||
          // Last resort: short trailing token from example URL
          button.example?.[0]?.split('otp').pop()?.slice(0, 15);
        // Dynamic URL buttons take only the {{1}} segment (OTP codes max 15 chars).
        variables.push({
          key: `button.${buttonIndex}.1`,
          component: 'button',
          index: 1,
          buttonIndex,
          label: `Button “${button.text || 'URL'}” code/path (≤15 chars)`,
          example,
          maxLength: 15,
        });
      });
    }
  }

  return { bodyText, headerText, variables };
}

export function toSendableTemplate(row: MetaTemplate): SendableTemplate {
  const parsed = parseTemplateVariables(row.components);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    language: row.language,
    category: row.category,
    ...parsed,
  };
}

export async function listWhatsAppTemplates(config: WhatsAppConfig): Promise<{
  templates: MetaTemplate[];
  error?: string;
}> {
  const { ok, data } = await metaFetch<{ data?: MetaTemplate[] }>(
    `/${config.wabaId}/message_templates?limit=100&fields=name,status,language,category,id,components`,
    config.accessToken
  );
  if (!ok) return { templates: [], error: data.error?.message || 'Failed to list templates' };
  return { templates: data.data || [] };
}

const ADMIN_TEMPLATE_NAMES = Object.values(ADMIN_TEMPLATES);

export function isAdminTemplate(name: string | null | undefined): boolean {
  return Boolean(name && ADMIN_TEMPLATE_NAMES.includes(name as (typeof ADMIN_TEMPLATE_NAMES)[number]));
}

/**
 * Look up a submitted admin template. Creation stays in Meta Business Manager
 * so the Visit Website button and approved copy are not overwritten here.
 */
export async function ensureOpsTemplate(config: WhatsAppConfig): Promise<{
  name: string;
  status: string;
  category?: string;
  created: boolean;
  error?: string;
}> {
  const listed = await listWhatsAppTemplates(config);
  if (listed.error) {
    return {
      name: config.templateName,
      status: 'MISSING',
      created: false,
      error: listed.error,
    };
  }
  const existing =
    pickSendTemplate(listed.templates, config.templateName) ||
    listed.templates.find((row) => row.name === config.templateName);
  if (existing) {
    return {
      name: existing.name,
      status: existing.status,
      category: existing.category,
      created: false,
    };
  }
  return {
    name: config.templateName,
    status: 'MISSING',
    created: false,
    error: `Submit ${ADMIN_TEMPLATE_NAMES.join(', ')} in Meta and wait for APPROVED.`,
  };
}

export function pickSendTemplate(
  templates: MetaTemplate[],
  preferredName: string
): MetaTemplate | null {
  const preferred = templates.find((row) => row.name === preferredName);
  if (preferred?.status === 'APPROVED' && preferred.category !== 'MARKETING') return preferred;

  const approvedUtility = templates.find(
    (row) =>
      row.status === 'APPROVED' &&
      row.category === 'UTILITY' &&
      ADMIN_TEMPLATE_NAMES.includes(row.name as (typeof ADMIN_TEMPLATE_NAMES)[number])
  );
  if (approvedUtility) return approvedUtility;

  if (preferred) return preferred;

  for (const name of ADMIN_TEMPLATE_NAMES) {
    const row = templates.find((item) => item.name === name);
    if (row) return row;
  }
  for (const name of LEGACY_OPS_TEMPLATE_NAMES) {
    const row = templates.find((item) => item.name === name);
    if (row) return row;
  }
  return null;
}

function cleanParam(value: string, max = 1024): string {
  return value.replace(/[\n\t]/g, ' ').trim().slice(0, max);
}

export async function sendWhatsAppTemplate(input: {
  config: WhatsAppConfig;
  to: string;
  shopName: string;
  /** Kept for session fallback / logging. */
  message?: string;
  templateName?: string;
  language?: string;
  /** Explicit body {{n}} values in order. When omitted, defaults to [shopName]. */
  bodyParams?: string[];
  headerParams?: string[];
  /** Dynamic URL button path suffixes, keyed by button index. */
  buttonParams?: Array<{ index: number; text: string }>;
}): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: number }> {
  const to = normalizeWhatsAppPhone(input.to);
  if (!to) return { success: false, error: 'Shop phone number is not valid for WhatsApp' };

  const shopName = cleanParam(input.shopName, 60) || 'Shop';
  const templateName = input.templateName || input.config.templateName;
  const language = (input.language || 'en').trim() || 'en';
  const bodyParams =
    input.bodyParams !== undefined
      ? input.bodyParams.map((value) => cleanParam(value) || '-')
      : [shopName];
  const headerParams = (input.headerParams || []).map((value) => cleanParam(value) || '-');
  const buttonParams = input.buttonParams || [];

  const components: Array<Record<string, unknown>> = [];
  if (headerParams.length > 0) {
    components.push({
      type: 'header',
      parameters: headerParams.map((text) => ({ type: 'text', text })),
    });
  }
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    });
  }
  for (const button of buttonParams) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(button.index),
      parameters: [{ type: 'text', text: cleanParam(button.text, 200) || '-' }],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  debugWhatsApp('sendWhatsAppTemplate', {
    shopName,
    message: input.message ?? null,
    wabaId: input.config.wabaId,
    phoneNumberId: input.config.phoneNumberId,
    displayPhone: input.config.displayPhone,
    payload,
  });

  const { ok, status, data } = await metaFetch<{ messages?: Array<{ id?: string }> }>(
    `/${input.config.phoneNumberId}/messages`,
    input.config.accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!ok) {
    debugWhatsApp('sendWhatsAppTemplate failed', {
      httpStatus: status,
      error: data.error,
    });
    return {
      success: false,
      error: data.error?.message || 'WhatsApp template send failed',
      errorCode: data.error?.code,
    };
  }
  debugWhatsApp('sendWhatsAppTemplate accepted', {
    messageId: data.messages?.[0]?.id ?? null,
    contacts: (data as { contacts?: unknown }).contacts ?? null,
    messages: data.messages ?? null,
  });
  return { success: true, messageId: data.messages?.[0]?.id };
}

export async function sendWhatsAppSessionText(input: {
  config: WhatsAppConfig;
  to: string;
  message: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: number }> {
  const to = normalizeWhatsAppPhone(input.to);
  if (!to) return { success: false, error: 'Shop phone number is not valid for WhatsApp' };
  const message = input.message.trim().slice(0, 3500);
  if (!message) return { success: false, error: 'Message is required' };

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message, preview_url: false },
  };

  debugWhatsApp('sendWhatsAppSessionText', {
    wabaId: input.config.wabaId,
    phoneNumberId: input.config.phoneNumberId,
    displayPhone: input.config.displayPhone,
    payload,
  });

  const { ok, status, data } = await metaFetch<{ messages?: Array<{ id?: string }> }>(
    `/${input.config.phoneNumberId}/messages`,
    input.config.accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!ok) {
    debugWhatsApp('sendWhatsAppSessionText failed', {
      httpStatus: status,
      error: data.error,
    });
    return {
      success: false,
      error: data.error?.message || 'WhatsApp session send failed',
      errorCode: data.error?.code,
    };
  }
  debugWhatsApp('sendWhatsAppSessionText accepted', {
    messageId: data.messages?.[0]?.id ?? null,
    messages: data.messages ?? null,
  });
  return { success: true, messageId: data.messages?.[0]?.id };
}
