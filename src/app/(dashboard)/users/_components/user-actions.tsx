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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Ban, CheckCircle, Key, MoreVertical } from 'lucide-react';
import { disableUser, enableUser, forcePasswordReset } from '@/services/user-management.service';

interface UserActionsProps {
  userShopRoleId: string;
  userId: string;
  isDisabled: boolean;
}

export function UserActions({ userShopRoleId, userId, isDisabled }: UserActionsProps) {
  const router = useRouter();
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetEmailed, setResetEmailed] = useState(false);

  const handleDisable = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    const result = await disableUser(userShopRoleId, reason);
    setLoading(false);

    if (result.success) {
      toast.success('User access disabled successfully');
      setShowDisableDialog(false);
      setReason('');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to disable user');
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    const result = await enableUser(userShopRoleId, notes);
    setLoading(false);

    if (result.success) {
      toast.success('User access enabled successfully');
      setShowEnableDialog(false);
      setNotes('');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to enable user');
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    const result = await forcePasswordReset(userId);
    setLoading(false);
    setShowMenu(false);

    if (result.success) {
      setResetEmailed(result.data.emailed);
      setResetLink(result.data.recoveryLink);
      toast.success(
        result.data.emailed
          ? 'Password reset email sent'
          : 'Reset link created. Email delivery did not confirm.'
      );
    } else {
      toast.error(result.error || 'Failed to send password reset');
    }
  };

  return (
    <>
      <div className="flex gap-2 relative">
        {isDisabled ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEnableDialog(true)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Enable
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDisableDialog(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Ban className="h-4 w-4 mr-1" />
            Disable
          </Button>
        )}

        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg z-10">
              <button
                onClick={handlePasswordReset}
                disabled={loading}
                className="w-full px-4 py-2 text-left text-sm hover:bg-ink-100 flex items-center"
              >
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable User</DialogTitle>
            <DialogDescription>
              This turns off this person’s access to this shop. If they have no other live shop, their sign-in session is ended.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason (Required)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Suspicious activity, Terms violation"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisableDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisable}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700"
              >
                Disable User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enable Dialog */}
      <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable User</DialogTitle>
            <DialogDescription>
              This will restore login access for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for re-enabling..."
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEnableDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEnable}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Enable User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetLink != null} onOpenChange={(open) => !open && setResetLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
            <DialogDescription>
              {resetEmailed
                ? 'A reset email was requested from Supabase. Share this link only if the email does not arrive.'
                : 'Supabase did not confirm an email. Send this one-time link to the shop owner yourself.'}
            </DialogDescription>
          </DialogHeader>
          {resetLink ? (
            <Input readOnly value={resetLink} onFocus={(event) => event.currentTarget.select()} />
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={() => setResetLink(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
