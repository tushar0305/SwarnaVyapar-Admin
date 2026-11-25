'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Shop } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { suspendShop, unsuspendShop } from '@/services/shop-management.service';
import { toast } from 'sonner';
import { Ban, Check, MoreVertical } from 'lucide-react';
import { Toaster } from 'sonner';

interface ShopActionsProps {
  shop: Shop;
}

export function ShopActions({ shop }: ShopActionsProps) {
  const router = useRouter();
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [unsuspendDialogOpen, setUnsuspendDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSuspend() {
    if (!reason.trim()) {
      toast.error('Please provide a reason for suspension');
      return;
    }

    setLoading(true);
    const result = await suspendShop({
      shopId: shop.id,
      reason,
      notes: notes || undefined,
    });

    if (result.success) {
      const ended = result.data.sessionsRevoked;
      toast.success(
        ended > 0
          ? `Shop suspended. ${ended} sign-in session${ended === 1 ? '' : 's'} ended.`
          : 'Shop suspended. This shop is blocked on the next request. People with another live shop stay signed in.'
      );
      setSuspendDialogOpen(false);
      setReason('');
      setNotes('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  async function handleUnsuspend() {
    setLoading(true);
    const result = await unsuspendShop(shop.id, notes || undefined);

    if (result.success) {
      toast.success('Shop access restored');
      setUnsuspendDialogOpen(false);
      setNotes('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="flex gap-2">
        {shop.is_suspended ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => setUnsuspendDialogOpen(true)}
          >
            <Check className="w-4 h-4" />
            Restore Access
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setSuspendDialogOpen(true)}
          >
            <Ban className="w-4 h-4" />
            Suspend Shop
          </Button>
        )}
      </div>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Shop</DialogTitle>
            <DialogDescription>
              This will immediately block all access to {shop.shop_name}. All users will be logged out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Reason (Required)</label>
              <Input
                placeholder="e.g., Payment overdue, Terms violation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Additional Notes (Optional)</label>
              <Input
                placeholder="Internal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={loading}>
              {loading ? 'Suspending...' : 'Suspend Shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsuspend Dialog */}
      <Dialog open={unsuspendDialogOpen} onOpenChange={setUnsuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Shop Access</DialogTitle>
            <DialogDescription>
              Restores {shop.shop_name}. People sign in again with their existing password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input
                placeholder="Reason for restoring access..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnsuspendDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleUnsuspend} disabled={loading}>
              {loading ? 'Restoring...' : 'Restore Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
