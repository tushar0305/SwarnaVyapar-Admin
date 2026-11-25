'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DISCOVERED_LEAD_STATUSES,
  DISCOVERED_LEAD_STATUS_LABEL,
  whatsappHref,
  type DiscoveredLeadStatus,
} from '@/lib/lead-discovery';
import { toDatetimeLocalIst } from '@/lib/lead-score';
import { formatDateTime } from '@/lib/utils';
import {
  checkDiscoveredLeadWebsite,
  enrichDiscoveredLead,
  generateAiLeadScripts,
  getDiscoveredLeadDetail,
  logDiscoveredLeadActivity,
  regenerateLeadScripts,
  scanLeadCompetitors,
  updateDiscoveredLead,
  type DiscoveredLeadEvent,
  type DiscoveredLeadRow,
} from '@/services/lead-discovery.service';

const field =
  'mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

function Linkish({ shopId, name }: { shopId: string; name: string | null }) {
  return (
    <a href={`/shops/${shopId}`} className="font-medium underline hover:text-gold-700">
      {name || 'shop'}
    </a>
  );
}

export function LeadDetailPanel({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<DiscoveredLeadRow | null>(null);
  const [events, setEvents] = useState<DiscoveredLeadEvent[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<DiscoveredLeadStatus>('new');
  const [owner, setOwner] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const detail = await getDiscoveredLeadDetail(leadId);
      if (!detail) {
        toast.error('Lead not found');
        onClose();
        return;
      }
      setLead(detail.lead);
      setEvents(detail.events);
      setDraft(detail.draftMessage);
      setStatus(detail.lead.status);
      setOwner(detail.lead.owner_name || '');
      setFollowUp(toDatetimeLocalIst(detail.lead.follow_up_at));
      setNotes(detail.lead.notes || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load lead');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateDiscoveredLead({
        id: leadId,
        status,
        ownerName: owner,
        followUpLocal: followUp,
        notes,
        eventNote: eventNote || undefined,
      });
      toast.success('Lead saved');
      setEventNote('');
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onEnrich() {
    setSaving(true);
    try {
      const result = await enrichDiscoveredLead(leadId);
      toast.success(
        result.billed
          ? 'Enriched (1 SerpApi credit)'
          : 'Enriched from cache (free)'
      );
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enrich failed');
    } finally {
      setSaving(false);
    }
  }

  async function onCheckSite() {
    setSaving(true);
    try {
      const result = await checkDiscoveredLeadWebsite(leadId);
      toast.success(result.reachable ? 'Website reachable' : 'Website looks unreachable');
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Check failed');
    } finally {
      setSaving(false);
    }
  }

  async function logActivity(eventType: 'call' | 'whatsapp' | 'note' | 'maps', body?: string) {
    try {
      await logDiscoveredLeadActivity({ id: leadId, eventType, body });
      await load();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not log activity');
    }
  }

  const wa = lead ? whatsappHref(lead.phone, draft) : null;

  // Portal to body — animate-in-soft / transforms on the shell break position:fixed
  // and push this drawer thousands of px off-screen (white blank side panel).
  const panel = (
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-ink-900/30"
      role="dialog"
      aria-modal="true"
      aria-label="Prospect detail"
    >
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="flex h-dvh w-full max-w-lg flex-col border-l border-ink-100 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-700">
              Prospect
            </p>
            <h2 className="truncate font-serif text-xl text-ink-900">
              {loading ? 'Loading…' : lead?.business_name || 'Lead'}
            </h2>
            {lead ? (
              <p className="mt-1 text-xs text-ink-500">
                Score {lead.score} ({lead.score_band}) · confidence{' '}
                {Math.round(lead.confidence * 100)}%
              </p>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading && !lead ? (
            <p className="text-sm text-ink-400">Loading prospect…</p>
          ) : null}
          {lead ? (
            <>
              <div className="rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                <p className="font-medium text-ink-900">Suggested pitch</p>
                <p className="mt-1 text-xs leading-relaxed">{lead.suggested_pitch || '—'}</p>
                {lead.score_reasons?.length ? (
                  <ul className="mt-2 space-y-1 text-[11px] text-ink-500">
                    {lead.score_reasons.map((reason) => (
                      <li key={`${reason.text}-${reason.points}`}>
                        {reason.points > 0 ? '+' : ''}
                        {reason.points} · {reason.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-ink-600">
                <p>
                  <span className="text-ink-400">Phone</span>
                  <br />
                  {lead.phone || '—'}
                </p>
                <p>
                  <span className="text-ink-400">Distance</span>
                  <br />
                  {lead.distance_km != null ? `${lead.distance_km} km` : '—'}
                </p>
                <p className="col-span-2">
                  <span className="text-ink-400">Address</span>
                  <br />
                  {lead.address || '—'}
                </p>
                <p className="col-span-2">
                  <span className="text-ink-400">Website</span>
                  <br />
                  {lead.website || '—'}
                  {lead.website_reachable === false ? ' (unreachable)' : ''}
                  {lead.website_reachable === true ? ' (reachable)' : ''}
                </p>
                <p className="col-span-2">
                  <span className="text-ink-400">Open state</span>
                  <br />
                  {lead.open_state || '—'}
                </p>
              </div>

              {lead.operating_hours && Object.keys(lead.operating_hours).length ? (
                <div className="rounded-md border border-ink-100 px-3 py-2 text-xs text-ink-700">
                  <p className="font-medium text-ink-900">Hours (from enrich)</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {Object.entries(lead.operating_hours).map(([day, hours]) => (
                      <li key={day} className="flex justify-between gap-3">
                        <span className="text-ink-500">{day}</span>
                        <span className="text-right text-ink-800">{hours}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {lead.place_links?.length ? (
                <div className="rounded-md border border-ink-100 px-3 py-2 text-xs text-ink-700">
                  <p className="font-medium text-ink-900">Links (from enrich)</p>
                  <ul className="mt-1.5 space-y-1">
                    {lead.place_links.map((item) => {
                      const href = item.link?.startsWith('http')
                        ? item.link
                        : item.link
                          ? `https://${item.link}`
                          : null;
                      if (!href) return null;
                      return (
                        <li key={href}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-700 underline hover:text-gold-700"
                          >
                            {item.source || href}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : lead.enriched_at ? (
                <p className="text-[11px] text-ink-400">Enriched — no public social links found.</p>
              ) : (
                <p className="text-[11px] text-ink-400">
                  Enrich place to pull hours and social / booking links (1 SerpApi credit unless
                  cached).
                </p>
              )}

              {lead.matched_shop_id ? (
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  Already on SwarnaVyapar as{' '}
                  <Linkish shopId={lead.matched_shop_id} name={lead.matched_shop_name} />
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={onEnrich}>
                  Enrich place
                </Button>
                {lead.website ? (
                  <Button size="sm" variant="outline" disabled={saving} onClick={onCheckSite}>
                    Check website
                  </Button>
                ) : null}
                {lead.website ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const result = await scanLeadCompetitors(leadId);
                        if (result.signals.length) {
                          toast.success(
                            `Found evidence: ${result.signals.map((s) => s.vendor).join(', ')}`
                          );
                        } else {
                          toast.success(
                            result.error
                              ? `Scan done (${result.error}) — no vendor mentions`
                              : 'No public competitor mentions found'
                          );
                        }
                        await load();
                        router.refresh();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Scan failed');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Scan competitors
                  </Button>
                ) : null}
                {lead.phone ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(`tel:+91${lead.phone}`, '_self');
                      void logActivity('call', 'Outbound call started');
                    }}
                  >
                    Call
                  </Button>
                ) : null}
                {wa ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(wa, '_blank', 'noopener,noreferrer');
                      void logActivity('whatsapp', 'Opened WhatsApp draft');
                    }}
                  >
                    WhatsApp draft
                  </Button>
                ) : null}
                {lead.maps_url ? (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    onClick={() => {
                      void logActivity('maps', 'Opened Google Business profile');
                    }}
                  >
                    <a href={lead.maps_url} target="_blank" rel="noopener noreferrer">
                      Google profile
                    </a>
                  </Button>
                ) : null}
              </div>

              {lead.competitor_signals?.length ? (
                <div className="rounded-md border border-ink-100 px-3 py-2 text-xs text-ink-700">
                  <p className="font-medium text-ink-900">Public competitor evidence</p>
                  <ul className="mt-1 space-y-1">
                    {lead.competitor_signals.map((signal) => (
                      <li key={`${signal.vendor}-${signal.matched}`}>
                        <strong>{signal.vendor}</strong>: “{signal.evidence}”
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="block text-sm text-ink-600">
                Hinglish WhatsApp intro
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                />
              </label>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-800">Sales scripts</p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          const scripts = await generateAiLeadScripts(leadId);
                          setDraft(scripts.whatsappIntro);
                          toast.success(`AI scripts ready (${scripts.model})`);
                          await load();
                          router.refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'AI failed');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Generate with AI
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await regenerateLeadScripts(leadId);
                          toast.success('Template scripts refreshed');
                          await load();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'Failed');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Template
                    </Button>
                  </div>
                </div>
                {lead.ai_scripts_at ? (
                  <p className="text-[11px] text-ink-400">
                    AI last run {formatDateTime(lead.ai_scripts_at)}
                    {lead.ai_scripts_model ? ` · ${lead.ai_scripts_model}` : ''}
                  </p>
                ) : null}
                {lead.ai_talking_points?.length ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-ink-700">
                    {lead.ai_talking_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-sm font-medium text-ink-800">Call script</p>
                <pre className="whitespace-pre-wrap rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-700">
                  {lead.call_script || '—'}
                </pre>
                <p className="text-sm font-medium text-ink-800">Follow-up draft</p>
                <pre className="whitespace-pre-wrap rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-700">
                  {lead.follow_up_script || '—'}
                </pre>
              </div>

              <form onSubmit={onSave} className="space-y-3 border-t border-ink-100 pt-3">
                <label className="block text-sm text-ink-600">
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DiscoveredLeadStatus)}
                    className={field}
                  >
                    {DISCOVERED_LEAD_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {DISCOVERED_LEAD_STATUS_LABEL[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-ink-600">
                  Assigned owner
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className={field}
                    placeholder="Your name"
                  />
                </label>
                <label className="block text-sm text-ink-600">
                  Follow-up (IST)
                  <input
                    type="datetime-local"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-sm text-ink-600">
                  CRM notes
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-ink-600">
                  Activity note (appended to timeline)
                  <input
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                    className={field}
                    placeholder="Optional"
                  />
                </label>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save prospect'}
                </Button>
              </form>

              <div>
                <p className="text-sm font-medium text-ink-800">Activity</p>
                <ul className="mt-2 space-y-2">
                  {events.length === 0 ? (
                    <li className="text-xs text-ink-400">No activity yet</li>
                  ) : (
                    events.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-md border border-ink-100 px-2 py-1.5 text-xs text-ink-600"
                      >
                        <span className="font-medium text-ink-800">{event.event_type}</span>
                        {event.body ? ` · ${event.body}` : ''}
                        <div className="text-[10px] text-ink-400">
                          {formatDateTime(event.created_at)}
                          {event.created_by ? ` · ${event.created_by}` : ''}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
