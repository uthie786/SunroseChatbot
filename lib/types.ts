export type Turn = { role: 'user' | 'assistant'; content: string };

export type HandOverReason =
  | 'lead'
  | 'after_sales'
  | 'asked_for_person'
  | 'unsure'
  | 'unsupported_media';

// Product labels, matching Sunrose's own ranges (see knowledge/shared.md).
// Each one must also exist as a label in Chatwoot (Settings > Labels).
export const CATEGORIES = [
  'snowbros',
  'butcherbros',
  'bakerbros',
  'caterbros',
  'aircon',
  'chillbros',
  'combo-deal',
  'spares',
  'other-product',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Decision =
  | { type: 'reply'; text: string }
  | {
      type: 'hand_over';
      reason: HandOverReason;
      category: Category;
      customerName?: string;
      product?: string;
      quantity?: string;
      use?: string;
      summary: string;
      messageToCustomer: string;
    }
  | { type: 'close_junk'; reason: string };
