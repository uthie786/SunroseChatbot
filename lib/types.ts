export type Turn = { role: 'user' | 'assistant'; content: string };

export type HandOverReason =
  | 'lead'
  | 'after_sales'
  | 'asked_for_person'
  | 'unsure'
  | 'unsupported_media';

export type Category =
  | 'aircon'
  | 'butchery'
  | 'refrigeration'
  | 'catering'
  | 'bakery'
  | 'combo-deal'
  | 'other-product';

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
