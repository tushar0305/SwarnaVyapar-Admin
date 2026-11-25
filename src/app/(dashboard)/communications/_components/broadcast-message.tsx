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
import { broadcastMessage } from '@/services/communication.service';

export function BroadcastMessageDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    type: 'notification' as 'email' | 'notification' | 'both',
    priority: 'normal' as 'normal' | 'high',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.body.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setLoading(true);
    try {
      const result = await broadcastMessage(formData);

      if (result.inboxSent > 0) {
        toast.success(`In-app notice sent to ${result.inboxSent} shops`);
        if (result.emailSkipped) {
          toast.message('Email was not sent — no email provider is configured');
        }
        setOpen(false);
        setFormData({
          title: '',
          body: '',
          type: 'notification',
          priority: 'normal',
        });
        router.refresh();
      } else if (result.emailSkipped) {
        toast.error('Email delivery is not configured. Send an in-app notification instead.');
      } else {
        toast.error('Failed to send broadcast');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Send className="w-4 h-4" />
          Broadcast Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Broadcast Message to All Shops</DialogTitle>
          <DialogDescription>
            In-app notices land in each shop&apos;s Notification Center. Email is not configured yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Important Platform Update"
                required
              />
            </div>

            <div>
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Your message to all shops..."
                rows={6}
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Delivery Method</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as any,
                  })
                }
                className="flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                <option value="notification">In-App Notification Only</option>
                <option value="email">Email Only</option>
                <option value="both">Both Email & Notification</option>
              </select>
            </div>

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
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
              </select>
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
              {loading ? 'Sending...' : 'Send Broadcast'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
