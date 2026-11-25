import { normalizeWhatsAppPhone } from '@/lib/whatsapp/phone';

export function whatsappDigits(phone: string | null | undefined): string | null {
  return normalizeWhatsAppPhone(phone);
}

export function whatsappHref(phone: string | null | undefined, text: string): string | null {
  const digits = whatsappDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailtoHref(
  email: string | null | undefined,
  subject: string,
  body: string
): string | null {
  if (!email?.includes('@')) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
