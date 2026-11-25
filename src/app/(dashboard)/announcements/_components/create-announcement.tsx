'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { createAnnouncement } from '@/services/announcement.service';

export function CreateAnnouncement() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'critical' | 'maintenance',
    target_audience: 'all',
    is_published: false,
    expires_at: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setLoading(true);
    try {
      const result = await createAnnouncement({
        ...formData,
        expires_at: formData.expires_at || undefined,
      });

      if (result.success) {
        toast.success('Announcement created successfully');
        setOpen(false);
        setFormData({
          title: '',
          message: '',
          type: 'info',
          target_audience: 'all',
          is_published: false,
          expires_at: '',
        });
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to create announcement');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create announcement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Platform Announcement</DialogTitle>
          <DialogDescription>
            Drafts stay in admin. Publishing fans the message out to every active shop inbox.
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
                placeholder="e.g., Platform Maintenance Scheduled"
                required
              />
            </div>

            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder="Describe the announcement details..."
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
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
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <Label htmlFor="target_audience">Who should see it</Label>
              <select
                id="target_audience"
                value={formData.target_audience}
                onChange={(event) =>
                  setFormData({ ...formData, target_audience: event.target.value })
                }
                className="flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm"
              >
                <option value="all">Every active shop</option>
                <option value="starter">Starter and shops with no plan</option>
                <option value="professional">Professional</option>
                <option value="business">Business</option>
              </select>
              <p className="mt-1 text-xs text-ink-500">
                Publishing writes this into those shops’ in-app inbox.
              </p>
            </div>

            <div>
              <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
              <Input
                id="expires_at"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) =>
                  setFormData({ ...formData, expires_at: e.target.value })
                }
              />
              <p className="text-xs text-ink-500 mt-1">
                Leave empty for permanent announcement
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-ink-50 rounded-lg">
              <div>
                <Label htmlFor="is_published">Publish Immediately</Label>
                <p className="text-xs text-ink-500">
                  Write it into each shop&apos;s Notification Center now
                </p>
              </div>
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_published: checked })
                }
              />
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
              {loading ? 'Creating...' : 'Create Announcement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
