'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WhatsAppComposer } from './whatsapp-composer';

export function ShopWhatsAppDialog({
  shopId,
  shopName,
  phone,
  defaultMessage,
}: {
  shopId: string;
  shopName: string;
  phone: string | null;
  defaultMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!phone}>
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
          WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {shopName}</DialogTitle>
          <DialogDescription>
            Sends from the SwarnaVyapar Cloud API number. Free text works only inside Meta&apos;s
            24-hour window. Cold outreach needs an approved template.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          shops={[{ id: shopId, name: shopName, phone, reachable: Boolean(phone) }]}
          defaultShopId={shopId}
          defaultMessage={defaultMessage}
          defaultMode="session"
          compact
        />
      </DialogContent>
    </Dialog>
  );
}
