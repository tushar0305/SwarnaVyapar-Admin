'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { mailtoHref } from '@/lib/outreach';
import { nudgeShop } from '@/services/onboarding.service';
import { sendWhatsAppToShop } from '@/services/whatsapp-outreach.service';
import { GoogleReviewUnlockButton } from './google-review-unlock';

export function OutreachActions({
  shopId,
  shopName,
  phone,
  email,
  cohort,
  googleReviewsUnlocked = false,
  showGoogleReviewsUnlock = false,
}: {
  shopId: string;
  shopName: string;
  phone: string | null;
  email: string | null;
  cohort: string;
  googleReviewsUnlocked?: boolean;
  showGoogleReviewsUnlock?: boolean;
}) {
  const [busy, setBusy] = useState<'nudge' | 'wa' | null>(null);
  const mail = mailtoHref(
    email,
    `SwarnaVyapar — ${shopName}`,
    `Hi ${shopName}, this is SwarnaVyapar. Need any help getting the shop fully set up?`
  );

  async function sendNudge() {
    setBusy('nudge');
    try {
      const result = await nudgeShop({ shopId, cohort });
      toast.success(result.sent ? 'In-app nudge sent' : 'Nothing sent');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to nudge shop');
    } finally {
      setBusy(null);
    }
  }

  async function sendWhatsApp() {
    setBusy('wa');
    try {
      const result = await sendWhatsAppToShop({ shopId, cohort });
      if (result.sent) {
        toast.success(
          result.note ||
            `Meta accepted WhatsApp for ${result.shopName} (${result.maskedPhone}). This is not a delivery receipt.`
        );
      } else {
        toast.error(result.error || 'WhatsApp was not sent');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'WhatsApp send failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {showGoogleReviewsUnlock ? (
        <GoogleReviewUnlockButton
          shopId={shopId}
          shopName={shopName}
          unlocked={googleReviewsUnlocked}
        />
      ) : null}
      {phone ? (
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={sendWhatsApp}>
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
          {busy === 'wa' ? 'Sending…' : 'WhatsApp'}
        </Button>
      ) : null}
      {mail ? (
        <Button size="sm" variant="outline" asChild>
          <a href={mail} onClick={(e) => e.stopPropagation()}>
            <Mail className="mr-1 h-3.5 w-3.5" />
            Email
          </a>
        </Button>
      ) : null}
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={sendNudge}>
        <Bell className="mr-1 h-3.5 w-3.5" />
        {busy === 'nudge' ? 'Sending…' : 'Nudge'}
      </Button>
    </div>
  );
}
