'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  cancelSubscription,
  reactivateSubscription,
} from '@/services/subscription-management.service';

export function SubscriptionActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const canceled = status === 'canceled' || status === 'cancelled';

  async function run(action: 'cancel' | 'reactivate') {
    setLoading(true);
    try {
      if (action === 'cancel') {
        await cancelSubscription(id, 'Cancelled from the subscriptions page');
        toast.success('Subscription cancelled');
      } else {
        await reactivateSubscription(id);
        toast.success('Subscription set active');
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the subscription');
    } finally {
      setLoading(false);
    }
  }

  return canceled ? (
    <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => run('reactivate')}>
      Reactivate
    </Button>
  ) : (
    <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => run('cancel')}>
      Cancel
    </Button>
  );
}
