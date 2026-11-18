import type { Decision, Turn } from './types';

// Fake "AI" for building and testing the Chatwoot side without Claude credits.
// Send these words in the Bot Test inbox to trigger each path:
//   "person" / "quote" / "agent"  -> hand_over
//   "ok" / "thanks" / "spam"      -> close_junk
//   "error"                       -> simulated failure (tests the fallback)
//   anything else                 -> echo reply
export function mockDecide(turns: Turn[]): Decision {
  const last = turns.at(-1)?.content ?? '';
  const text = last.toLowerCase().trim();

  if (text.includes('error')) {
    throw new Error('Mock error requested');
  }
  if (/\b(person|human|agent|quote)\b/.test(text)) {
    return {
      type: 'hand_over',
      reason: 'asked_for_person',
      category: 'other-product',
      customerName: 'Mock customer',
      product: 'Mock product',
      quantity: '1',
      use: 'business',
      summary: 'MOCK: customer asked for a person.',
      messageToCustomer: 'Mock: thanks! A Sunrose consultant will continue this chat shortly.',
    };
  }
  if (/^(ok|okay|thanks|thank you|spam)\b/.test(text)) {
    return { type: 'close_junk', reason: 'MOCK: junk message' };
  }
  return { type: 'reply', text: `Mock reply: ${last}` };
}
