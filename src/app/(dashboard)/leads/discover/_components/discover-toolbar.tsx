'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { matchDiscoveredLeadsToShops, rescoreAllDiscoveredLeads } from '@/services/lead-discovery.service';

export function DiscoverToolbar() {
  const router = useRouter();
  const [busy, setBusy] = useState<'match' | 'rescore' | null>(null);

  async function onMatch() {
    setBusy('match');
    try {
      const result = await matchDiscoveredLeadsToShops();
      toast.success(`Matched ${result.matched} of ${result.checked} phones to existing shops`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Match failed');
    } finally {
      setBusy(null);
    }
  }

  async function onRescore() {
    setBusy('rescore');
    try {
      const result = await rescoreAllDiscoveredLeads();
      toast.success(`Rescored ${result.updated} prospects`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rescore failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={onMatch}>
        {busy === 'match' ? 'Matching…' : 'Match existing shops'}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={onRescore}>
        {busy === 'rescore' ? 'Rescoring…' : 'Rescore all'}
      </Button>
    </div>
  );
}
