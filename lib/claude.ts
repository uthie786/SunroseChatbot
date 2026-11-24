import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, type Category, type Decision, type HandOverReason, type Turn } from './types';

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-5-5';

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

// Ask Claude what to do with the latest customer message.
// Claude either writes a reply, or calls one of two tools; our code carries the tool out.
// `system` = rules + knowledge (the same every time, so it is cached).
// `rightNow` = current date/time and open/closed status (changes, so it goes after the cached part).
export async function decide(system: string, rightNow: string, turns: Turn[]): Promise<Decision> {
  const first = await ask(system, rightNow, turns, false);
  if (first) return first;
  // Rarely Claude answers with nothing at all. Try once more, this time requiring a tool call,
  // so the worst case is a normal handover with a summary instead of a silent chat.
  console.warn('[bot] Claude returned nothing, retrying with a required tool call');
  const second = await ask(system, rightNow, turns, true);
  if (second) return second;
  throw new Error('Claude returned no text and no tool call (twice)');
}

async function ask(
  system: string,
  rightNow: string,
  turns: Turn[],
  forceTool: boolean,
): Promise<Decision | null> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 700,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: rightNow },
    ],
    messages: turns,
    tools: [
      {
        name: 'hand_over',
        description:
          'Hand the conversation to a Sunrose salesperson. Use once the customer has answered your details question, ' +
          'or immediately if they ask for a person, are unhappy, have a fault/return, or you are unsure.',
        input_schema: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              enum: ['lead', 'after_sales', 'order_status', 'bulk_order', 'asked_for_person', 'unsure', 'unknown_deal'],
              description:
                'lead = buying enquiry; after_sales = fault, spare part, return or refund; order_status = existing order or delivery; ' +
                'bulk_order = large quantity, trade or wholesale; unknown_deal = a deal or price (e.g. seen on Facebook) not in the knowledge.',
            },
            category: {
              type: 'string',
              enum: [...CATEGORIES],
              description: 'The product range label from the knowledge (e.g. snowbros for fridges and freezers).',
            },
            customer_name: { type: 'string' },
            product: { type: 'string' },
            quantity: { type: 'string' },
            use: { type: 'string', description: 'home or business' },
            summary: { type: 'string', description: 'One or two sentences for the salesperson.' },
            message_to_customer: {
              type: 'string',
              description:
                'Short message telling the customer what happens next. If Sunrose is OPEN: a consultant will continue the chat. ' +
                'If CLOSED: the team is closed and a consultant will reply at the next opening time (say when). Never say "now" or "shortly" when closed.',
            },
          },
          required: ['reason', 'category', 'summary', 'message_to_customer'],
        },
      },
      {
        name: 'close_junk',
        description:
          'Close the chat without involving staff: spam, wrong numbers, or a message like "ok", "thanks" or an emoji with nothing to answer.',
        input_schema: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    ],
    ...(forceTool ? { tool_choice: { type: 'any' as const } } : {}),
  });

  const toolUse = res.content.find((block) => block.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    const input = (toolUse.input ?? {}) as Record<string, string | undefined>;
    if (toolUse.name === 'hand_over') {
      return {
        type: 'hand_over',
        reason: (input.reason as HandOverReason) ?? 'unsure',
        category: CATEGORIES.includes(input.category as Category)
          ? (input.category as Category)
          : 'other-product',
        customerName: input.customer_name,
        product: input.product,
        quantity: input.quantity,
        use: input.use,
        summary: input.summary ?? '',
        messageToCustomer:
          input.message_to_customer ?? 'Thanks! A Sunrose consultant will continue this chat shortly.',
      };
    }
    if (toolUse.name === 'close_junk') {
      return { type: 'close_junk', reason: input.reason ?? '' };
    }
  }

  const text = res.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    console.warn(
      `[bot] empty Claude response: stop_reason=${res.stop_reason}, blocks=${JSON.stringify(res.content).slice(0, 500)}`,
    );
    return null;
  }
  return { type: 'reply', text };
}
