'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Phone, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DISCOVERED_LEAD_STATUSES,
  DISCOVERED_LEAD_STATUS_LABEL,
  whatsappHref,
  type DiscoveredLeadStatus,
} from '@/lib/lead-discovery';
import { formatDateTime } from '@/lib/utils';
import {
  bulkUpdateDiscoveredLeads,
  exportDiscoveredLeadsCsv,
  updateDiscoveredLead,
  type DiscoveredLeadRow,
  type DiscoveryListFilters,
} from '@/services/lead-discovery.service';
import { LeadDetailPanel } from './lead-detail-panel';

const field =
  'h-8 rounded-md border border-ink-300 bg-white px-2 text-xs text-ink-900';

function bandVariant(band: string): 'success' | 'warning' | 'outline' {
  if (band === 'high') return 'success';
  if (band === 'medium') return 'warning';
  return 'outline';
}

export function DiscoveredLeadsTable({
  rows,
  filters,
}: {
  rows: DiscoveredLeadRow[];
  filters: DiscoveryListFilters;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveStatus(id: string, status: DiscoveredLeadStatus) {
    setBusyId(id);
    try {
      await updateDiscoveredLead({ id, status });
      toast.success(`Marked ${DISCOVERED_LEAD_STATUS_LABEL[status].toLowerCase()}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update');
    } finally {
      setBusyId(null);
    }
  }

  async function bulkStatus(status: DiscoveredLeadStatus) {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      const result = await bulkUpdateDiscoveredLeads({
        ids: Array.from(selected),
        status,
      });
      toast.success(`Updated ${result.updated} leads`);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportCsv() {
    setBulkBusy(true);
    try {
      const csv = await exportDiscoveredLeadsCsv(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sv-discovered-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded — for manual outreach only');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBulkBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-ink-500">
        No discovered shops yet. Run a neighbourhood or city search above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">{selected.size} selected</span>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.size || bulkBusy}
          onClick={() => bulkStatus('contacted')}
        >
          Contacted
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.size || bulkBusy}
          onClick={() => bulkStatus('callback')}
        >
          Call back
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.size || bulkBusy}
          onClick={() => bulkStatus('no_answer')}
        >
          No answer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.size || bulkBusy}
          onClick={() => bulkStatus('not_interested')}
        >
          Not interested
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.size || bulkBusy}
          onClick={() => bulkStatus('dismissed')}
        >
          Dismiss
        </Button>
        <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const wa = whatsappHref(row.phone);
          const busy = busyId === row.id;
          return (
            <li
              key={row.id}
              className="rounded-lg border border-ink-100 bg-white p-3 shadow-sm shadow-ink-900/5"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(row.id)}
                  onChange={() => toggleOne(row.id)}
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="text-left font-medium text-ink-900"
                    onClick={() => setDetailId(row.id)}
                  >
                    {row.business_name}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant={bandVariant(row.score_band)} className="text-[10px]">
                      {row.score} · {row.score_band}
                    </Badge>
                    {row.digital_gap ? (
                      <Badge variant="gold" className="text-[10px]">
                        Digital gap
                      </Badge>
                    ) : null}
                    {row.is_chain ? (
                      <Badge variant="outline" className="text-[10px]">
                        Chain
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {row.neighbourhood || row.city}
                    {row.distance_km != null ? ` · ${row.distance_km} km` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600">
                    {row.suggested_pitch || 'No pitch yet'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      className={field}
                      value={row.status}
                      disabled={busy}
                      onChange={(e) => saveStatus(row.id, e.target.value as DiscoveredLeadStatus)}
                    >
                      {DISCOVERED_LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {DISCOVERED_LEAD_STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => setDetailId(row.id)}>
                      Open
                    </Button>
                    {wa ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={wa} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    {row.maps_url ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={row.maps_url} target="_blank" rel="noopener noreferrer">
                          Google
                        </a>
                      </Button>
                    ) : null}
                    {row.phone ? (
                      <a
                        href={`tel:+91${row.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-ink-700"
                      >
                        <Phone className="h-3 w-3" />
                        {row.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400">
              <th className="px-2 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-2 py-2 font-medium">Score</th>
              <th className="px-2 py-2 font-medium">Shop</th>
              <th className="px-2 py-2 font-medium">Contact</th>
              <th className="px-2 py-2 font-medium">Pitch</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const wa = whatsappHref(row.phone);
              const busy = busyId === row.id;
              return (
                <tr key={row.id} className="border-b border-ink-50 align-top">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-serif text-lg text-ink-900">{row.score}</span>
                      <Badge variant={bandVariant(row.score_band)} className="w-fit text-[10px]">
                        {row.score_band}
                      </Badge>
                      {row.digital_gap ? (
                        <Badge variant="gold" className="w-fit text-[10px]">
                          Digital gap
                        </Badge>
                      ) : null}
                      {row.is_chain ? (
                        <Badge variant="outline" className="w-fit text-[10px]">
                          Chain
                        </Badge>
                      ) : null}
                      {row.matched_shop_id ? (
                        <Badge variant="info" className="w-fit text-[10px]">
                          Existing shop
                        </Badge>
                      ) : null}
                      {row.competitor_signals?.length ? (
                        <Badge variant="secondary" className="w-fit text-[10px]">
                          {row.competitor_signals.length} competitor
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-ink-900 hover:text-gold-700"
                      onClick={() => setDetailId(row.id)}
                    >
                      {row.business_name}
                    </button>
                    <p className="mt-0.5 max-w-xs text-xs text-ink-500">
                      {row.address || 'No address'}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {row.neighbourhood || row.city}
                      {row.distance_km != null ? ` · ${row.distance_km} km` : ''}
                      {row.rating != null
                        ? ` · ★ ${row.rating}${row.reviews_count != null ? ` (${row.reviews_count})` : ''}`
                        : ''}
                    </p>
                    <p className="text-[11px] text-ink-400">{formatDateTime(row.discovered_at)}</p>
                  </td>
                  <td className="px-2 py-3">
                    {row.phone ? (
                      <a
                        href={`tel:+91${row.phone}`}
                        className="inline-flex items-center gap-1 text-ink-800 hover:text-gold-700"
                      >
                        <Phone className="h-3 w-3" />
                        {row.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-ink-400">No phone</span>
                    )}
                    {row.website ? (
                      <a
                        href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-ink-600 hover:text-gold-700"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                        {row.website_reachable === false ? ' (down?)' : ''}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-xs text-ink-600">
                    <p className="max-w-[12rem] leading-snug">
                      {row.suggested_pitch || '—'}
                    </p>
                    {row.owner_name ? (
                      <p className="mt-1 text-ink-400">Owner: {row.owner_name}</p>
                    ) : null}
                    {row.follow_up_at ? (
                      <p className="mt-1 text-amber-700">
                        Follow-up {formatDateTime(row.follow_up_at)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <select
                      className={field}
                      value={row.status}
                      disabled={busy}
                      onChange={(e) => saveStatus(row.id, e.target.value as DiscoveredLeadStatus)}
                    >
                      {DISCOVERED_LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {DISCOVERED_LEAD_STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(row.id)}>
                        Open
                      </Button>
                      {wa ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={wa} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                      ) : null}
                      {row.maps_url ? (
                        <Button size="sm" variant="outline" asChild title="Open Google Business profile">
                          <a href={row.maps_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Google
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailId ? (
        <LeadDetailPanel leadId={detailId} onClose={() => setDetailId(null)} />
      ) : null}
    </div>
  );
}
