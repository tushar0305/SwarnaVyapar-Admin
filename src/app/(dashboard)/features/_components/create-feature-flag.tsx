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
import { Slider } from '@/components/ui/slider';
import { createFeatureFlag } from '@/services/feature-flags.service';

export function CreateFeatureFlag() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    feature_key: '',
    name: '',
    description: '',
    is_enabled_globally: false,
    rollout_percentage: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createFeatureFlag(formData);

      if (result.success) {
        toast.success('Feature flag created successfully');
        setOpen(false);
        setFormData({
          feature_key: '',
          name: '',
          description: '',
          is_enabled_globally: false,
          rollout_percentage: 0,
        });
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to create feature flag');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create feature flag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Feature Flag
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
          <DialogDescription>
            Create a new feature flag to control feature rollouts across the platform
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="feature_key">Feature Key *</Label>
              <Input
                id="feature_key"
                value={formData.feature_key}
                onChange={(e) =>
                  setFormData({ ...formData, feature_key: e.target.value })
                }
                placeholder="e.g., invoice_templates_v2"
                required
              />
              <p className="text-xs text-ink-500 mt-1">
                Unique identifier (lowercase, underscores only)
              </p>
            </div>

            <div>
              <Label htmlFor="name">Display Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Invoice Templates V2"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this feature does..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-ink-50 rounded-lg">
              <div>
                <Label htmlFor="is_enabled_globally">Enable Globally</Label>
                <p className="text-xs text-ink-500">
                  Turn on this feature for all shops
                </p>
              </div>
              <Switch
                id="is_enabled_globally"
                checked={formData.is_enabled_globally}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_enabled_globally: checked })
                }
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="rollout_percentage">Rollout Percentage</Label>
                <span className="text-sm font-medium text-gold-700">
                  {formData.rollout_percentage}%
                </span>
              </div>
              <Slider
                id="rollout_percentage"
                min={0}
                max={100}
                step={5}
                value={[formData.rollout_percentage]}
                onValueChange={(value) =>
                  setFormData({ ...formData, rollout_percentage: value[0] })
                }
                className="w-full"
              />
              <p className="text-xs text-ink-500 mt-1">
                Percentage of shops that will see this feature (when enabled)
              </p>
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
              {loading ? 'Creating...' : 'Create Feature Flag'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
