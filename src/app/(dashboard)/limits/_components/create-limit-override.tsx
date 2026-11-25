'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { createLimitOverride } from '@/services/limit-management.service';
import { ShopPicker } from '../../_components/shop-picker';

export function CreateLimitOverride() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('');
  const [formData, setFormData] = useState({
    shopId: '',
    maxInvoices: '',
    maxUsers: '',
    expiresAt: '',
    reason: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shopId || !formData.reason) {
      toast.error('Shop and reason are required');
      return;
    }

    setLoading(true);
    const result = await createLimitOverride({
      shopId: formData.shopId,
      maxInvoices: formData.maxInvoices ? Number(formData.maxInvoices) : undefined,
      maxUsers: formData.maxUsers ? Number(formData.maxUsers) : undefined,
      expiresAt: formData.expiresAt || undefined,
      reason: formData.reason,
      notes: formData.notes || undefined,
    });
    setLoading(false);

    if (result.success) {
      toast.success('Limit override created successfully');
      setOpen(false);
      setFormData({
        shopId: '',
        maxInvoices: '',
        maxUsers: '',
        expiresAt: '',
        reason: '',
        notes: '',
      });
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to create override');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-ink-900 hover:bg-ink-800">
          <Plus className="h-4 w-4 mr-2" />
          Create Override
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Limit Override</DialogTitle>
          <DialogDescription>
            Set custom limits for a specific shop. Leave fields empty for unlimited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Shop</label>
            <div className="mt-1">
              <ShopPicker
                shopId={formData.shopId}
                shopName={shopName}
                onChange={(shop) => {
                  setFormData({ ...formData, shopId: shop.id });
                  setShopName(shop.name);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Max Invoices</label>
              <Input
                type="number"
                min="0"
                value={formData.maxInvoices}
                onChange={(e) => setFormData({ ...formData, maxInvoices: e.target.value })}
                placeholder="Leave empty for unlimited"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max Users</label>
              <Input
                type="number"
                min="0"
                value={formData.maxUsers}
                onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                placeholder="Leave empty for unlimited"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Expires At (Optional)</label>
            <Input
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="mt-1"
            />
            <p className="text-xs text-ink-500 mt-1">
              Leave empty for permanent override
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Reason (Required)</label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Enterprise customer, Special promotion"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Notes (Optional)</label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional context..."
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-ink-900 hover:bg-ink-800"
            >
              {loading ? 'Creating...' : 'Create Override'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
