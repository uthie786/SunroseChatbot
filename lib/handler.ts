import { BRANCHES_BY_INBOX, type Branch } from '@/config/branches';
import { adContextText, findAdInConversation } from './ad';
import { businessStatusText, getBusinessStatus } from '@/config/hours';
import {
  addLabels,
  addPrivateNote,
  assignAgent,
  assignTeam,
  getAdminUserId,
  getConversationInfo,
  getMessages,
  isIncoming,
  isOutgoing,
  sendReply,
  setPriority,
  setStatus,
  type CwMessage,
} from './chatwoot';
import { decide } from './claude';
import { buildSystemPrompt } from './knowledge';
import { mockDecide } from './mock';
import type { Decision, Turn } from './types';

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS ?? 4000);
const MAX_TURNS = 20;
// Chats older than this are "returning" customers: the bot stays out and staff take them.
const MAX_CHAT_AGE_HOURS = Number(process.env.BOT_MAX_CHAT_AGE_HOURS ?? 12);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The shape of the Chatwoot webhook we use. Chatwoot sends more fields than this.
type ChatwootEvent = {
  event?: string;
  id?: number;
  content?: string | null;
  message_type?: string | number;
  private?: boolean;
  conversation?: { id?: number; status?: string; inbox_id?: number; additional_attributes?: unknown };
  inbox?: { id?: number };
  content_attributes?: unknown;
  additional_attributes?: unknown;
};

export async function handleEvent(body: ChatwootEvent) {
  // 1. Only new incoming customer messages.
  if (body.event !== 'message_created') return;
  if (!(body.message_type === 'incoming' || body.message_type === 0) || body.private) return;

  const conversationId = body.conversation?.id;
  const inboxId = body.inbox?.id ?? body.conversation?.inbox_id;
  if (!conversationId || !inboxId) return;

  // 2. Only inboxes listed in config/branches.ts.
  const branch = BRANCHES_BY_INBOX[inboxId];
  if (!branch) {
    console.log(`[bot] ignoring inbox ${inboxId} (not in config/branches.ts)`);
    return;
  }

  const log = (msg: string) => console.log(`[bot] conv ${conversationId} (${branch.key}): ${msg}`);

  // 3. Only while the bot owns the chat. "open" means a person has it.
  if (body.conversation?.status && body.conversation.status !== 'pending') {
    log(`status is ${body.conversation.status}, staying silent`);
    return;
  }

  try {
    // 4. Wait briefly so several quick messages get one reply.
    await sleep(DEBOUNCE_MS);

    const info = await getConversationInfo(conversationId);
    if (info.status && info.status !== 'pending') {
      log(`status changed to ${info.status} while waiting, staying silent`);
      return;
    }

    const history = await getMessages(conversationId);
    const lastIncoming = [...history].reverse().find(isIncoming);
    if (body.id && lastIncoming && lastIncoming.id !== body.id) {
      log('a newer customer message arrived, letting that one answer');
      return;
    }

    // Old chat that got a new message (e.g. reopened after being resolved):
    // the bot doesn't know the earlier context, so pass it straight to staff without replying.
    const createdAt = info.createdAt ?? history[0]?.created_at;
    if (createdAt && Date.now() / 1000 - createdAt > MAX_CHAT_AGE_HOURS * 3600) {
      await passToStaffSilently(conversationId, branch);
      log('returning customer (old chat), passed to staff without replying');
      return;
    }

    const hours = getBusinessStatus();

    // 5. Voice notes, photos and files: the bot can't read them, so hand over.
    const content = (body.content ?? '').trim();
    if (!content) {
      await handOver(conversationId, branch, {
        type: 'hand_over',
        reason: 'unsupported_media',
        category: 'other-product',
        summary: 'Customer sent a voice note, photo or file that the bot cannot read.',
        messageToCustomer: hours.isOpen
          ? 'Thanks! A Sunrose consultant will look at this and get back to you shortly.'
          : `Thanks! Our team is closed right now. A Sunrose consultant will look at this and reply ${hours.nextOpenText}.`,
      });
      log('media message, handed over');
      return;
    }

    // 6. Did they come from an ad? (Meta attaches the ad to their first message.)
    const ad = findAdInConversation([
      body.content_attributes,
      body.additional_attributes,
      body.conversation?.additional_attributes,
      ...history.flatMap((m) => [m.content_attributes, m.additional_attributes]),
    ]);
    if (ad) log(`came from an ad: ${ad.headline ?? ad.sourceUrl ?? 'no headline'}`);

    // 7. Ask the AI (or the mock) what to do.
    const turns = toTurns(history, content);
    const rightNow = [businessStatusText(hours), adContextText(ad)].filter(Boolean).join('\n\n');
    const decision: Decision =
      process.env.BOT_MODE === 'live'
        ? await decide(buildSystemPrompt(branch), rightNow, turns)
        : mockDecide(turns, hours);

    // 7. Carry it out.
    if (decision.type === 'reply') {
      await sendReply(conversationId, decision.text);
      log('replied');
    } else if (decision.type === 'hand_over') {
      await handOver(conversationId, branch, decision);
      log(`handed over (${decision.reason}, ${decision.category})`);
    } else {
      await closeJunk(conversationId);
      log('closed as junk');
    }
  } catch (err) {
    // 8. Anything fails: a person gets the chat. Never leave the customer hanging.
    console.error(`[bot] conv ${conversationId} error:`, err);
    await fallback(conversationId, branch).catch((e) =>
      console.error(`[bot] conv ${conversationId} fallback also failed:`, e),
    );
  }
}

// Chatwoot history -> alternating user/assistant turns for Claude.
function toTurns(history: CwMessage[], latest: string): Turn[] {
  const turns: Turn[] = [];
  for (const m of history) {
    const text = m.content?.trim();
    if (m.private || !text) continue;
    const role = isIncoming(m) ? 'user' : isOutgoing(m) ? 'assistant' : null;
    if (!role) continue; // activity messages etc.
    const prev = turns.at(-1);
    if (prev && prev.role === role) prev.content += `\n${text}`;
    else turns.push({ role, content: text });
  }

  // Claude needs the conversation to start and end with the customer.
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns.at(-1)?.role !== 'user') turns.push({ role: 'user', content: latest });

  let trimmed = turns.slice(-MAX_TURNS);
  while (trimmed.length && trimmed[0].role !== 'user') trimmed = trimmed.slice(1);
  return trimmed;
}

// Team first (so the whole branch sees it), then a specific login if one is set.
async function assignBranch(conversationId: number, branch: Branch) {
  if (branch.teamId) await assignTeam(conversationId, branch.teamId);
  if (branch.assigneeId === 'admin') {
    await assignAgent(conversationId, await getAdminUserId());
  } else if (branch.assigneeId) {
    await assignAgent(conversationId, branch.assigneeId);
  }
  if (!branch.teamId && !branch.assigneeId) {
    console.log(`[bot] conv ${conversationId}: no teamId/assigneeId for ${branch.key}, left unassigned`);
  }
}

// Status label(s) for each handover reason, plus the product label.
function labelsFor(d: Extract<Decision, { type: 'hand_over' }>): string[] {
  const byReason: Record<string, string[]> = {
    after_sales: ['after-sales'],
    order_status: ['order-status'],
    bulk_order: ['lead', 'bulk-order'],
    unknown_deal: ['lead', 'deal-check'],
  };
  return [...(byReason[d.reason] ?? ['lead']), d.category];
}

async function handOver(
  conversationId: number,
  branch: Branch,
  d: Extract<Decision, { type: 'hand_over' }>,
) {
  await sendReply(conversationId, d.messageToCustomer);

  await addLabels(conversationId, labelsFor(d)).catch((e) => console.error('[bot] labels failed:', e));
  if (d.reason === 'bulk_order') {
    await setPriority(conversationId, 'high').catch((e) => console.error('[bot] priority failed:', e));
  }

  const note = [
    'Bot summary',
    `Reason: ${d.reason.replace(/_/g, ' ')}`,
    `Name: ${d.customerName || 'not given'}`,
    `Product: ${d.product || 'not given'}`,
    `Quantity: ${d.quantity || 'not given'}`,
    `Use: ${d.use || 'not given'}`,
    `Summary: ${d.summary}`,
  ].join('\n');
  await addPrivateNote(conversationId, note);

  await setStatus(conversationId, 'open');
  await assignBranch(conversationId, branch).catch((e) => console.error('[bot] assign failed:', e));
}

async function passToStaffSilently(conversationId: number, branch: Branch) {
  await addLabels(conversationId, ['returning']).catch((e) => console.error('[bot] labels failed:', e));
  await addPrivateNote(
    conversationId,
    'Returning customer: this is an older chat, so the bot did not reply. Please read the history and reply.',
  );
  await setStatus(conversationId, 'open');
  await assignBranch(conversationId, branch).catch((e) => console.error('[bot] assign failed:', e));
}

async function closeJunk(conversationId: number) {
  await addLabels(conversationId, ['junk']).catch((e) => console.error('[bot] labels failed:', e));
  await setStatus(conversationId, 'resolved');
}

async function fallback(conversationId: number, branch: Branch) {
  await addPrivateNote(conversationId, 'Bot error: the assistant could not reply. Please take over this chat.');
  await addLabels(conversationId, ['bot-error']).catch(() => undefined);
  await setStatus(conversationId, 'open');
  await assignBranch(conversationId, branch).catch(() => undefined);
}
