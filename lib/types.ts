import type { LocationKey } from '@/config/locations';

export type Turn = { role: 'user' | 'assistant'; content: string };

export type HandOverReason =
  | 'lead'
  | 'after_sales'
  | 'asked_for_person'
  | 'unsure'
  | 'unknown_deal' // customer asks about a deal/price that isn't in the knowledge
  | 'bulk_order' // large / trade order: labelled bulk-order and set to high priority
  | 'order_status' // existing order or delivery question
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
  // Hardware, building and decor (knowledge/hardware.md)
  'maestro', // Maestro Paints
  'hardware', // everything else from Sunrose Importers & Wholesalers
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
      visitBranches?: LocationKey[]; // branches to show for visiting or calling
    }
  | { type: 'close_junk'; reason: string };
