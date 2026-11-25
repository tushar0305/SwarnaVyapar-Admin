/** Rule-based scoring for SerpApi-discovered jewellery prospects. */

export type DiscoveredScoreReason = {
  points: number;
  text: string;
};

export type DiscoveredScoreInput = {
  businessName: string;
  category: string | null;
  types: string[];
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  distanceKm: number | null;
  websiteReachable?: boolean | null;
};

export type DiscoveredScoreResult = {
  score: number;
  band: 'high' | 'medium' | 'low';
  reasons: DiscoveredScoreReason[];
  isChain: boolean;
  digitalGap: boolean;
  suggestedPitch: string;
  confidence: number;
};

/** Large branded chains — deprioritise for SV outbound (independents first). */
export const JEWELLERY_CHAIN_NAMES = [
  'tanishq',
  'malabar gold',
  'malabar',
  'kalyan jewellers',
  'kalyan',
  'joyalukkas',
  'joy alukkas',
  'pc jeweller',
  'p.c. jeweller',
  'senco gold',
  'senco',
  'tribhovandas',
  'tbz',
  'grt jewellers',
  'grt',
  'png jewellers',
  'orra',
  'caratlane',
  'bluestone',
  'candere',
  'reliance jewels',
  'jos alukkas',
] as const;

const JEWELLERY_TYPE_HINTS = [
  'jewel',
  'jeweller',
  'jewelry',
  'gold',
  'silver',
  'diamond',
  'ornament',
  'bullion',
];

export function isLikelyJewelleryChain(name: string): boolean {
  const n = name.toLowerCase();
  return JEWELLERY_CHAIN_NAMES.some((brand) => n.includes(brand));
}

function isJewelleryRelevant(category: string | null, types: string[], name: string): boolean {
  const hay = `${category || ''} ${types.join(' ')} ${name}`.toLowerCase();
  return JEWELLERY_TYPE_HINTS.some((h) => hay.includes(h));
}

export function suggestPitch(input: {
  hasWebsite: boolean;
  websiteReachable: boolean | null | undefined;
  isChain: boolean;
  reviewsCount: number | null;
}): string {
  if (input.isChain) return 'Low priority — branded chain; focus on independents';
  if (!input.hasWebsite) {
    return 'Catalogue + billing — strong offline shop, no public website';
  }
  if (input.websiteReachable === false) {
    return 'Catalogue — listed website looks unreachable or outdated';
  }
  if ((input.reviewsCount || 0) >= 50) {
    return 'WhatsApp + billing — established shop; digital ops upgrade';
  }
  return 'Full shop demo — billing, stock, catalogue, WhatsApp';
}

export function scoreDiscoveredLead(input: DiscoveredScoreInput): DiscoveredScoreResult {
  const reasons: DiscoveredScoreReason[] = [];
  let score = 0;
  const isChain = isLikelyJewelleryChain(input.businessName);

  if (isJewelleryRelevant(input.category, input.types, input.businessName)) {
    score += 25;
    reasons.push({ points: 25, text: 'Jewellery-related category or name' });
  } else {
    score += 5;
    reasons.push({ points: 5, text: 'Weak jewellery category match' });
  }

  if (input.phone) {
    score += 20;
    reasons.push({ points: 20, text: 'Public phone listed on Maps' });
  } else {
    reasons.push({ points: 0, text: 'No phone on Maps' });
  }

  const hasWebsite = Boolean(input.website);
  if (!hasWebsite) {
    score += 18;
    reasons.push({ points: 18, text: 'No website — digital gap (strong SV fit)' });
  } else if (input.websiteReachable === false) {
    score += 12;
    reasons.push({ points: 12, text: 'Website listed but unreachable' });
  } else {
    score += 4;
    reasons.push({ points: 4, text: 'Has a website (still may need ops software)' });
  }

  const reviews = input.reviewsCount || 0;
  if (reviews >= 100) {
    score += 15;
    reasons.push({ points: 15, text: `${reviews} reviews — established offline presence` });
  } else if (reviews >= 30) {
    score += 10;
    reasons.push({ points: 10, text: `${reviews} reviews — proven footfall` });
  } else if (reviews >= 5) {
    score += 5;
    reasons.push({ points: 5, text: `${reviews} reviews` });
  }

  if (input.rating != null && input.rating >= 4.2 && reviews >= 10) {
    score += 5;
    reasons.push({ points: 5, text: `Strong rating ${input.rating}` });
  }

  if (input.distanceKm != null && input.distanceKm <= 15) {
    score += 5;
    reasons.push({ points: 5, text: `Nearby (${input.distanceKm} km)` });
  }

  if (isChain) {
    score -= 35;
    reasons.push({ points: -35, text: 'Looks like a national/branded chain' });
  } else {
    score += 8;
    reasons.push({ points: 8, text: 'Independent / non-chain heuristic' });
  }

  score = Math.max(0, Math.min(100, score));
  const band: DiscoveredScoreResult['band'] =
    score >= 55 ? 'high' : score >= 35 ? 'medium' : 'low';

  const digitalGap = !hasWebsite || input.websiteReachable === false;
  const suggestedPitch = suggestPitch({
    hasWebsite,
    websiteReachable: input.websiteReachable,
    isChain,
    reviewsCount: input.reviewsCount,
  });

  let confidence = 0.45;
  if (input.phone) confidence += 0.15;
  if (input.website) confidence += 0.1;
  if (reviews >= 10) confidence += 0.15;
  if (isJewelleryRelevant(input.category, input.types, input.businessName)) confidence += 0.1;
  confidence = Math.min(0.95, Math.round(confidence * 100) / 100);

  return {
    score,
    band,
    reasons,
    isChain,
    digitalGap,
    suggestedPitch,
    confidence,
  };
}
