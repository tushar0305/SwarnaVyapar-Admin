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
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteLimitOverride } from '@/services/limit-management.service';

interface LimitActionsProps {
  overrideId: string;
  shopName: string;
}

export function LimitActions({ overrideId, shopName }: LimitActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteLimitOverride(overrideId);
    setLoading(false);

    if (result.success) {
      toast.success('Limit override removed');
      setShowDeleteDialog(false);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to remove override');
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowDeleteDialog(true)}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Remove
      </Button>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Limit Override</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this limit override for {shopName}?
              The shop will revert to its subscription plan limits.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Removing...' : 'Remove Override'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
