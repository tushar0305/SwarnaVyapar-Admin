export const INQUIRY_STATUSES = [
  'new',
  'contacted',
  'demo_scheduled',
  'converted',
  'lost',
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  demo_scheduled: 'Demo scheduled',
  converted: 'Converted',
  lost: 'Lost',
};

export const INQUIRY_INTERESTS = ['trial', 'demo', 'pricing', 'sales'] as const;

export type InquiryInterest = (typeof INQUIRY_INTERESTS)[number];

export const INQUIRY_INTEREST_LABEL: Record<InquiryInterest, string> = {
  trial: 'Trial',
  demo: 'Demo',
  pricing: 'Pricing',
  sales: 'Sales',
};

export function isInquiryStatus(value: string): value is InquiryStatus {
  return (INQUIRY_STATUSES as readonly string[]).includes(value);
}

export function isInquiryInterest(value: string): value is InquiryInterest {
  return (INQUIRY_INTERESTS as readonly string[]).includes(value);
}

export function formatInquiryPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function waMeHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!/^91[6-9]\d{9}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
