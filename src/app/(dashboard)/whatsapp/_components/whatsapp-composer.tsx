'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SendableTemplate } from '@/lib/whatsapp/cloud';
import {
  listSendableWhatsAppTemplates,
  sendWhatsAppToShop,
} from '@/services/whatsapp-outreach.service';

type SendMode = 'session' | 'template' | 'auto';

function templateKey(row: SendableTemplate) {
  return `${row.name}::${row.language}`;
}

function fillPreview(text: string | null, values: Record<string, string>, component: 'header' | 'body') {
  if (!text) return null;
  return text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const value = values[`${component}.${n}`]?.trim();
    return value || `{{${n}}}`;
  });
}

function defaultSelection(rows: SendableTemplate[]) {
  if (rows.length === 0) return '';
  const preferred =
    rows.find((row) => row.name.startsWith('sv_admin_') && row.category === 'UTILITY') ||
    rows.find((row) => row.category === 'UTILITY') ||
    rows.find((row) => row.category !== 'MARKETING') ||
    rows[0];
  return templateKey(preferred);
}

function isMarketing(row: SendableTemplate | null) {
  return (row?.category || '').toUpperCase() === 'MARKETING';
}

export function WhatsAppComposer({
  shops,
  defaultShopId,
  defaultMessage,
  compact,
  defaultMode = 'session',
  initialTemplates,
}: {
  shops: Array<{ id: string; name: string; phone: string | null; reachable: boolean }>;
  defaultShopId?: string;
  defaultMessage?: string;
  compact?: boolean;
  defaultMode?: SendMode;
  initialTemplates?: SendableTemplate[];
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState(defaultShopId || shops.find((s) => s.reachable)?.id || '');
  const [message, setMessage] = useState(defaultMessage || '');
  const [mode, setMode] = useState<SendMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<SendableTemplate[]>(initialTemplates || []);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState(() => defaultSelection(initialTemplates || []));
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [allowMarketing, setAllowMarketing] = useState(false);
  const fetchedOnce = useRef(Boolean(initialTemplates && initialTemplates.length > 0));

  const selectedShop = shops.find((shop) => shop.id === shopId) || null;
  const selected = templates.find((row) => templateKey(row) === selectedKey) || null;
  const usesTemplate = mode === 'template' || mode === 'auto';
  const selectedIsMarketing = isMarketing(selected);

  useEffect(() => {
    if (!usesTemplate || fetchedOnce.current) return;
    fetchedOnce.current = true;
    let cancelled = false;
    setTemplatesLoading(true);
    void listSendableWhatsAppTemplates()
      .then((result) => {
        if (cancelled) return;
        setTemplates(result.templates);
        setTemplatesError(result.error);
        setSelectedKey((current) => current || defaultSelection(result.templates));
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplatesError(error instanceof Error ? error.message : 'Could not load templates');
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [usesTemplate]);

  useEffect(() => {
    setAllowMarketing(false);
    if (!selected) {
      setVarValues({});
      return;
    }
    const isAuth = (selected.category || '').toUpperCase() === 'AUTHENTICATION';
    const next: Record<string, string> = {};
    for (const field of selected.variables) {
      // Auth OTP body/button must be the short code — never the shop name or full URL.
      if (isAuth) {
        next[field.key] = field.example || '123456';
      } else if (field.component === 'body' && field.index === 1 && selectedShop?.name) {
        next[field.key] = selectedShop.name;
      } else {
        next[field.key] = field.example || '';
      }
    }
    // Keep OTP body + copy-code button in sync when both exist.
    if (isAuth && next['body.1'] && next['button.0.1'] !== undefined) {
      next['button.0.1'] = next['body.1'];
    }
    setVarValues(next);
    // Re-seed when template or shop changes; do not depend on the whole selected object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectedShop?.id, selectedShop?.name]);

  const bodyPreview = useMemo(
    () => fillPreview(selected?.bodyText ?? null, varValues, 'body'),
    [selected?.bodyText, varValues]
  );
  const headerPreview = useMemo(
    () => fillPreview(selected?.headerText ?? null, varValues, 'header'),
    [selected?.headerText, varValues]
  );

  async function refreshTemplates() {
    setTemplatesLoading(true);
    try {
      const result = await listSendableWhatsAppTemplates();
      fetchedOnce.current = true;
      setTemplates(result.templates);
      setTemplatesError(result.error);
      if (result.templates.length > 0) {
        const stillThere = result.templates.some((row) => templateKey(row) === selectedKey);
        if (!stillThere) setSelectedKey(defaultSelection(result.templates));
      } else {
        setSelectedKey('');
      }
      toast.success(
        result.templates.length
          ? `Loaded ${result.templates.length} approved template${result.templates.length === 1 ? '' : 's'}`
          : 'No approved templates yet'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function send() {
    if (!shopId) {
      toast.error('Choose a shop');
      return;
    }
    if (mode === 'session' && !message.trim()) {
      toast.error('Write the instruction first');
      return;
    }
    if (usesTemplate) {
      if (!selected) {
        toast.error('Choose a template');
        return;
      }
      const missing = selected.variables.find((field) => !varValues[field.key]?.trim());
      if (missing) {
        toast.error(`Fill ${missing.label}`);
        return;
      }
      const tooLong = selected.variables.find((field) => {
        const max = field.maxLength;
        if (!max) return false;
        return (varValues[field.key] || '').trim().length > max;
      });
      if (tooLong) {
        toast.error(
          `${tooLong.label} must be ≤ ${tooLong.maxLength} characters (Meta OTP/URL button limit). Send only the code, not the full URL.`
        );
        return;
      }
      if (isMarketing(selected) && !allowMarketing) {
        toast.error(
          'MARKETING templates are accepted by Meta but usually never arrive (confirmed on this WABA). Use UTILITY like appointment_confirmed, or tick the confirmation.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      const bodyParams =
        selected?.variables
          .filter((field) => field.component === 'body')
          .sort((a, b) => a.index - b.index)
          .map((field) => varValues[field.key] || '') ?? undefined;
      const headerParams =
        selected?.variables
          .filter((field) => field.component === 'header')
          .sort((a, b) => a.index - b.index)
          .map((field) => varValues[field.key] || '') ?? undefined;
      const buttonParams =
        selected?.variables
          .filter((field) => field.component === 'button')
          .map((field) => ({
            index: field.buttonIndex ?? 0,
            text: varValues[field.key] || '',
          })) ?? undefined;

      const result = await sendWhatsAppToShop({
        shopId,
        message:
          message.trim() ||
          (selected
            ? `Template ${selected.name}`
            : undefined),
        mode,
        ...(mode !== 'session' && selected
          ? {
              templateName: selected.name,
              templateLanguage: selected.language,
              bodyParams: bodyParams ?? [],
              headerParams: headerParams ?? [],
              buttonParams: buttonParams ?? [],
            }
          : {}),
      });
      if (result.sent) {
        const note =
          result.note ||
          `Meta accepted WhatsApp for ${result.shopName} (${result.maskedPhone}). This is not a delivery receipt.`;
        if (result.templateCategory === 'MARKETING') {
          toast.warning(note);
        } else {
          toast.success(note);
        }
        setMessage('');
        router.refresh();
      } else {
        toast.error(result.error || 'WhatsApp was not sent');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'WhatsApp send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {!defaultShopId ? (
        <div>
          <Label htmlFor="wa-shop">Shop</Label>
          <select
            id="wa-shop"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm"
          >
            <option value="">Select a shop</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id} disabled={!shop.reachable}>
                {shop.name}
                {shop.reachable ? '' : ' — no valid phone'}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="wa-mode">Send as</Label>
        <select
          id="wa-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as SendMode)}
          className="mt-1 flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm"
        >
          <option value="session">Free text · no template</option>
          <option value="template">Approved template</option>
          <option value="auto">Auto · selected template if ready, else free text</option>
        </select>
        <p className="mt-1 text-xs text-ink-500">
          {mode === 'session'
            ? 'Works only if this number messaged SwarnaVyapar WhatsApp in the last 24 hours. Meta blocks cold free-text outreach.'
            : mode === 'template'
              ? 'Pick any APPROVED Meta template. Fill every {{variable}} before send.'
              : 'Tries the selected template first, then free text if Meta allows it.'}
        </p>
      </div>

      {usesTemplate ? (
        <div className="space-y-3 rounded-md border border-ink-100 bg-ink-50/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="wa-template">Template</Label>
              <select
                id="wa-template"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                disabled={templatesLoading || templates.length === 0}
                className="mt-1 flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm"
              >
                {templates.length === 0 ? (
                  <option value="">
                    {templatesLoading ? 'Loading templates…' : 'No approved templates'}
                  </option>
                ) : (
                  templates.map((row) => (
                    <option key={templateKey(row)} value={templateKey(row)}>
                      {row.name} · {row.language}
                      {row.category ? ` · ${row.category}` : ''}
                      {row.variables.length
                        ? ` · ${row.variables.length} var${row.variables.length === 1 ? '' : 's'}`
                        : ' · no vars'}
                    </option>
                  ))
                )}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={templatesLoading}
              onClick={() => void refreshTemplates()}
            >
              {templatesLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

          {templatesError ? <p className="text-xs text-red-700">{templatesError}</p> : null}

          {selectedIsMarketing ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-900">
                Confirmed on this number: <code>appointment_confirmed</code> (Utility) arrives;
                <code> swarna_owner_welcome</code> (Marketing) is accepted by Meta and still does not
                show on the phone. Do not use Marketing for ops delivery checks.
              </p>
              <label className="flex items-start gap-2 text-xs text-amber-950">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allowMarketing}
                  onChange={(e) => setAllowMarketing(e.target.checked)}
                />
                I understand this may not deliver, send MARKETING anyway
              </label>
            </div>
          ) : null}

          {(selected?.category || '').toUpperCase() === 'AUTHENTICATION' ? (
            <p className="text-xs text-ink-600">
              Authentication OTP: body and button must be the short code only (≤15 chars), e.g.{' '}
              <code>123456</code> — not the shop name and not the full WhatsApp URL.
            </p>
          ) : null}

          {selected ? (
            <div className="space-y-2 text-xs text-ink-600">
              {headerPreview ? (
                <p>
                  <span className="font-medium text-ink-800">Header: </span>
                  {headerPreview}
                </p>
              ) : null}
              {bodyPreview ? (
                <p className="whitespace-pre-wrap">
                  <span className="font-medium text-ink-800">Body: </span>
                  {bodyPreview}
                </p>
              ) : (
                <p>No body text on this template.</p>
              )}
            </div>
          ) : null}

          {selected && selected.variables.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {selected.variables.map((field) => (
                <label key={field.key} className="text-sm text-ink-700">
                  {field.label}
                  <input
                    value={varValues[field.key] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setVarValues((prev) => {
                        const next = { ...prev, [field.key]: value };
                        // Auth templates: body OTP and copy-code button share one code.
                        if (
                          (selected.category || '').toUpperCase() === 'AUTHENTICATION' &&
                          field.key === 'body.1' &&
                          prev['button.0.1'] !== undefined
                        ) {
                          next['button.0.1'] = value;
                        }
                        return next;
                      });
                    }}
                    placeholder={field.example || `Value for {{${field.index}}}`}
                    maxLength={field.maxLength ?? 1024}
                    className="mt-1 flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm"
                    required
                  />
                </label>
              ))}
            </div>
          ) : selected ? (
            <p className="text-xs text-ink-500">This template has no variables — send as-is.</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor="wa-body">
          {usesTemplate ? 'Note (logged only)' : 'Instruction'}
        </Label>
        <Textarea
          id="wa-body"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={compact ? 3 : 5}
          maxLength={900}
          placeholder={
            usesTemplate
              ? 'Optional context for your records — the phone sees the Meta template.'
              : 'e.g. Finish GST and create the first invoice today. Reply here if you are stuck.'
          }
          required={mode === 'session'}
        />
      </div>
      <Button type="submit" disabled={loading || (usesTemplate && templatesLoading && !selected)}>
        {loading ? 'Sending…' : mode === 'session' ? 'Send free text' : 'Send WhatsApp'}
      </Button>
    </form>
  );
}
