'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Power, PowerOff, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FeatureFlag } from '@/services/feature-flags.service';
import {
  toggleFeatureFlag,
  deleteFeatureFlag,
} from '@/services/feature-flags.service';

interface FeatureActionsProps {
  flag: FeatureFlag;
}

export function FeatureActions({ flag }: FeatureActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const result = await toggleFeatureFlag(
        flag.feature_key,
        !flag.is_enabled_globally
      );

      if (result.success) {
        toast.success(
          `Feature ${flag.is_enabled_globally ? 'disabled' : 'enabled'} globally`
        );
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to toggle feature flag');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle feature flag');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteFeatureFlag(flag.feature_key);

      if (result.success) {
        toast.success('Feature flag deleted successfully');
        setShowDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete feature flag');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete feature flag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={loading}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleToggle}>
            {flag.is_enabled_globally ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                Disable Globally
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Enable Globally
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            Manage Overrides
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Flag
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feature Flag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the feature flag "{flag.name}"?
              This will also remove all shop-specific overrides for this feature.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
