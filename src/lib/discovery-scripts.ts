/** Template sales scripts for discovered jewellery prospects (no LLM required). */

export type SalesScripts = {
  whatsappIntro: string;
  callScript: string;
  followUp: string;
};

export function buildSalesScripts(input: {
  businessName: string;
  suggestedPitch: string | null;
  digitalGap: boolean;
  hasPhone: boolean;
  city: string;
}): SalesScripts {
  const name = input.businessName.trim() || 'ji';
  const city = input.city || 'aapke area';
  const pitch = input.suggestedPitch || '';

  const focus = pitch.includes('Catalogue')
    ? 'online catalogue aur billing'
    : pitch.includes('WhatsApp')
      ? 'WhatsApp pe bill share, stock alerts'
      : pitch.includes('Low priority')
        ? 'shop software (agar independent branch hai)'
        : 'billing, stock, catalogue aur WhatsApp';

  const gapLine = input.digitalGap
    ? 'Maps pe shop strong dikhti hai, lekin website/catalogue weak lagta hai — wahi gap hum cover karte hain.'
    : 'Aap already online ho; hum counter pe billing + stock simplify karte hain.';

  const whatsappIntro = `Namaste ${name} team, SwarnaVyapar se baat. ${city} ke jewellery shops ke liye ${focus} banaya hai. ${gapLine} 10 minute demo suit karega kya?`;

  const callScript = [
    `Opening: Namaste, main SwarnaVyapar se bol raha/rahi hoon — ${name} sahi hai?`,
    `Context: Hum ${city} ke jewellery counters ke liye ${focus} dete hain.`,
    `Hook: ${gapLine}`,
    `Ask: Kya abhi bill Excel/register pe banate ho, ya koi software chal raha hai?`,
    `Close: 10 minute demo book karun — aaj shaam ya kal subah?`,
    input.hasPhone ? '' : 'Note: Phone Maps pe nahi tha — visit / website se contact verify karein.',
  ]
    .filter(Boolean)
    .join('\n');

  const followUp = `Namaste ${name}, kal/pehle call miss ho gaya. SwarnaVyapar se short demo: ${focus}. Reply karein “demo” aur time bata dein.`;

  return { whatsappIntro, callScript, followUp };
}
