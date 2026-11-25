export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 13 && digits.startsWith('910') && /^910[6-9]\d{9}$/.test(digits)) {
    digits = `91${digits.slice(3)}`;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

export function maskPhone(phone: string | null | undefined): string {
  const digits = phone?.replace(/\D/g, '') || '';
  if (digits.length < 4) return '••••';
  return `${'•'.repeat(Math.max(digits.length - 4, 2))}${digits.slice(-4)}`;
}
