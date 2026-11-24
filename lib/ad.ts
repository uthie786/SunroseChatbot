// Click-to-WhatsApp ads: when a customer taps a Facebook/Instagram ad that opens WhatsApp,
// Meta attaches the ad's details (headline, text, link) to their first message, and Chatwoot
// stores them on that message (that's the "Ad" card you see in Chatwoot).
// Chatwoot's exact field names aren't documented, so we search for anything that looks like
// a Meta ad referral (headline / source_url / ctwa_clid / source_id).

export type AdInfo = { headline?: string; body?: string; sourceUrl?: string };

const MAX_TEXT = 500;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT) : undefined;
}

const AD_KEYS = [
  'headline', 'source_url', 'sourceUrl', 'ctwa_clid', 'ctwaClid', 'source_id', 'sourceId',
  'ad_title', 'adTitle', 'ad_headline',
];

function looksLikeAd(obj: Record<string, unknown>) {
  if (AD_KEYS.some((k) => typeof obj[k] === 'string')) return true;
  // Meta's referral object: { source_type: 'ad', ... }
  return obj.source_type === 'ad' || obj.sourceType === 'ad';
}

export function findAdInfo(value: unknown, depth = 0): AdInfo | null {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  const obj = value as Record<string, unknown>;
  if (looksLikeAd(obj)) {
    const ad = {
      headline: str(obj.headline ?? obj.ad_headline ?? obj.ad_title ?? obj.adTitle ?? obj.title),
      body: str(obj.body ?? obj.description),
      sourceUrl: str(obj.source_url ?? obj.sourceUrl ?? obj.url),
    };
    if (ad.headline || ad.body || ad.sourceUrl) return ad;
  }
  for (const child of Object.values(obj)) {
    const found = findAdInfo(child, depth + 1);
    if (found) return found;
  }
  return null;
}

// Look in the webhook and in every message of the chat (the ad sits on the first message).
export function findAdInConversation(sources: unknown[]): AdInfo | null {
  for (const source of sources) {
    const found = findAdInfo(source);
    if (found) return found;
  }
  return null;
}

export function adContextText(ad: AdInfo | null): string {
  if (!ad) return '';
  const lines = ['## How this customer found Sunrose', '- They tapped a Sunrose ad that opened this chat.'];
  if (ad.headline) lines.push(`- Ad headline: ${ad.headline}`);
  if (ad.body) lines.push(`- Ad text: ${ad.body}`);
  if (ad.sourceUrl) lines.push(`- Ad link: ${ad.sourceUrl}`);
  lines.push(
    "- This is Sunrose's own current ad, so its product and price are a confirmed current offer. " +
      'Do not treat it as an unknown deal and do not ask for a screenshot. Name the deal and price in your reply ' +
      'and include it in the hand_over summary.',
  );
  return lines.join('\n');
}
