// Small helpers for the Chatwoot API.
// Docs: https://developers.chatwoot.com/api-reference

const BASE = (process.env.CHATWOOT_URL ?? 'https://app.chatwoot.com').replace(/\/$/, '');
const ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID;
const BOT_TOKEN = process.env.CHATWOOT_BOT_TOKEN ?? '';
const ADMIN_TOKEN = process.env.CHATWOOT_ADMIN_TOKEN ?? '';

type Method = 'GET' | 'POST';

class ChatwootError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function cw(path: string, token: string, method: Method = 'GET', body?: unknown) {
  if (!ACCOUNT) throw new Error('CHATWOOT_ACCOUNT_ID is not set');
  const res = await fetch(`${BASE}/api/v1/accounts/${ACCOUNT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', api_access_token: token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ChatwootError(res.status, `Chatwoot ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

// Try with the bot token first (so actions show as the bot); fall back to the admin token
// if the bot token isn't allowed to do this.
async function cwAsBot(path: string, method: Method, body?: unknown) {
  try {
    return await cw(path, BOT_TOKEN, method, body);
  } catch (err) {
    if (err instanceof ChatwootError && [401, 403, 404].includes(err.status) && ADMIN_TOKEN) {
      return cw(path, ADMIN_TOKEN, method, body);
    }
    throw err;
  }
}

export type CwMessage = {
  id: number;
  content: string | null;
  message_type: number | string; // 0/'incoming', 1/'outgoing', 2/'activity', 3/'template'
  private: boolean;
  created_at: number;
  content_attributes?: unknown; // holds ad referrals, among other things
  additional_attributes?: unknown;
};

export function isIncoming(m: CwMessage) {
  return m.message_type === 0 || m.message_type === 'incoming';
}

export function isOutgoing(m: CwMessage) {
  return [1, 3, 'outgoing', 'template'].includes(m.message_type);
}

export async function getMessages(conversationId: number): Promise<CwMessage[]> {
  const data = await cw(`/conversations/${conversationId}/messages`, ADMIN_TOKEN);
  const list: CwMessage[] = data?.payload ?? [];
  return [...list].sort((a, b) => a.created_at - b.created_at);
}

export async function getConversationStatus(conversationId: number): Promise<string | undefined> {
  const data = await cw(`/conversations/${conversationId}`, ADMIN_TOKEN);
  return data?.status;
}

export async function sendReply(conversationId: number, content: string) {
  return cwAsBot(`/conversations/${conversationId}/messages`, 'POST', {
    content,
    message_type: 'outgoing',
    private: false,
  });
}

export async function addPrivateNote(conversationId: number, content: string) {
  return cwAsBot(`/conversations/${conversationId}/messages`, 'POST', {
    content,
    message_type: 'outgoing',
    private: true,
  });
}

// Chatwoot replaces the whole label list, so read the current labels and merge.
export async function addLabels(conversationId: number, labels: string[]) {
  const current = await cw(`/conversations/${conversationId}/labels`, ADMIN_TOKEN);
  const existing: string[] = current?.payload ?? [];
  const merged = Array.from(new Set([...existing, ...labels]));
  return cw(`/conversations/${conversationId}/labels`, ADMIN_TOKEN, 'POST', { labels: merged });
}

export async function setStatus(conversationId: number, status: 'open' | 'resolved' | 'pending') {
  return cwAsBot(`/conversations/${conversationId}/toggle_status`, 'POST', { status });
}

// The Chatwoot user that owns CHATWOOT_ADMIN_TOKEN (the admin login). Looked up once, then remembered.
let adminUserId: number | null = null;
export async function getAdminUserId(): Promise<number> {
  if (adminUserId) return adminUserId;
  const res = await fetch(`${BASE}/api/v1/profile`, { headers: { api_access_token: ADMIN_TOKEN } });
  if (!res.ok) throw new ChatwootError(res.status, `Chatwoot GET /profile -> ${res.status}`);
  const profile = (await res.json()) as { id?: number };
  if (!profile.id) throw new Error('Chatwoot profile has no id');
  adminUserId = profile.id;
  return adminUserId;
}

// For the ID lookup page (/api/chatwoot?secret=...&list=ids): names and IDs of agents, teams and inboxes.
export async function listIds() {
  const pick = (items: unknown) =>
    (Array.isArray(items) ? items : []).map((x: Record<string, unknown>) => ({
      id: x.id,
      name: x.name ?? x.available_name,
      ...(x.email ? { email: x.email } : {}),
      ...(x.role ? { role: x.role } : {}),
      ...(x.channel_type ? { type: x.channel_type } : {}),
    }));
  const [agents, teams, inboxes] = await Promise.all([
    cw('/agents', ADMIN_TOKEN).catch(() => []),
    cw('/teams', ADMIN_TOKEN).catch(() => []),
    cw('/inboxes', ADMIN_TOKEN).catch(() => ({ payload: [] })),
  ]);
  return {
    agents: pick(agents),
    teams: pick(teams),
    inboxes: pick(inboxes?.payload ?? inboxes),
  };
}

// Conversation priority (shows as a flag in Chatwoot and can be filtered/sorted on).
export async function setPriority(conversationId: number, priority: 'urgent' | 'high' | 'medium' | 'low') {
  return cw(`/conversations/${conversationId}/toggle_priority`, ADMIN_TOKEN, 'POST', { priority });
}

export async function assignTeam(conversationId: number, teamId: number) {
  return cw(`/conversations/${conversationId}/assignments`, ADMIN_TOKEN, 'POST', { team_id: teamId });
}

export async function assignAgent(conversationId: number, assigneeId: number) {
  return cw(`/conversations/${conversationId}/assignments`, ADMIN_TOKEN, 'POST', { assignee_id: assigneeId });
}
