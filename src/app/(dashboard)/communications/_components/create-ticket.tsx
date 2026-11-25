'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send } from 'lucide-react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSupportTicket } from '@/services/communication.service';
import { ShopPicker } from '../../_components/shop-picker';

interface CreateTicketDialogProps {
  shopId?: string;
  shopName?: string;
}

export function CreateTicketDialog({ shopId, shopName }: CreateTicketDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopLabel, setShopLabel] = useState(shopName || '');
  const [formData, setFormData] = useState({
    shopId: shopId || '',
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.shopId || !formData.subject.trim() || !formData.description.trim()) {
      toast.error('Shop, subject, and description are required');
      return;
    }

    setLoading(true);
    try {
      await createSupportTicket(formData);
      toast.success('Support ticket created successfully');
      setOpen(false);
      setFormData({
        shopId: shopId || '',
        subject: '',
        description: '',
        priority: 'medium',
        category: '',
      });
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Send className="w-4 h-4" />
          New Support Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Create a new support ticket for a shop
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {!shopId && (
              <div>
                <Label>Shop</Label>
                <ShopPicker
                  shopId={formData.shopId}
                  shopName={shopLabel}
                  onChange={(shop) => {
                    setFormData({ ...formData, shopId: shop.id });
                    setShopLabel(shop.name);
                  }}
                />
              </div>
            )}

            {shopName && (
              <div className="p-3 bg-ink-50 rounded-lg">
                <p className="text-sm text-ink-600">Shop</p>
                <p className="font-medium">{shopName}</p>
              </div>
            )}

            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description of the issue..."
                rows={5}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as any,
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                  <option value="">Select category</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="bug">Bug Report</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
