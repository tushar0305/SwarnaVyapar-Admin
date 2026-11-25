'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShopPicker } from '../../_components/shop-picker';
import {
  createFeatureOverride,
  deleteFeatureOverride,
} from '@/services/feature-flags.service';

export function FeatureOverrideForm({
  flags,
}: {
  flags: { feature_key: string; name: string }[];
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [featureKey, setFeatureKey] = useState(flags[0]?.feature_key || '');
  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!shopId || !featureKey) {
      toast.error('Choose a shop and a feature');
      return;
    }
    setLoading(true);
    const result = await createFeatureOverride({
      shop_id: shopId,
      feature_key: featureKey,
      is_enabled: enabled,
      reason: reason.trim() || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success('Shop override saved');
      setReason('');
      router.refresh();
    } else {
      toast.error(result.error || 'Could not save the override');
    }
  }

  if (flags.length === 0) return null;

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <ShopPicker
        shopId={shopId}
        shopName={shopName}
        onChange={(shop) => {
          setShopId(shop.id);
          setShopName(shop.name);
        }}
      />
      <select
        value={featureKey}
        onChange={(event) => setFeatureKey(event.target.value)}
        className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm"
      >
        {flags.map((flag) => (
          <option key={flag.feature_key} value={flag.feature_key}>
            {flag.name}
          </option>
        ))}
      </select>
      <select
        value={enabled ? 'on' : 'off'}
        onChange={(event) => setEnabled(event.target.value === 'on')}
        className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm"
      >
        <option value="on">On for this shop</option>
        <option value="off">Off for this shop</option>
      </select>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason"
      />
      <Button type="submit" disabled={loading} className="h-9">
        {loading ? 'Saving…' : 'Save override'}
      </Button>
    </form>
  );
}

export function RemoveFeatureOverride({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const result = await deleteFeatureOverride(id);
        setLoading(false);
        if (result.success) {
          toast.success('Override removed');
          router.refresh();
        } else {
          toast.error(result.error || 'Could not remove the override');
        }
      }}
    >
      Remove
    </Button>
  );
}
