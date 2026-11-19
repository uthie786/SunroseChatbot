// Which Chatwoot inbox belongs to which branch, and who gets its handovers.
//
// HOW TO FIND THE IDS (Chatwoot web app, look at the number at the end of the address bar):
//   Inbox ID:  Settings > Inboxes > click the inbox's settings
//   Team ID:   Settings > Teams > click the team
//   Agent ID:  Settings > Agents > click the agent (or hover the edit button)
//
// On handover the bot assigns the TEAM (everyone in it sees the chat) and then,
// if set, a specific AGENT (that person gets the notification).
// Leave a value as undefined if you don't use it.
// Any inbox NOT listed in BRANCHES_BY_INBOX is ignored by the bot.

export type BranchKey = 'durban' | 'johannesburg' | 'pretoria';

export type Branch = {
  key: BranchKey;
  name: string; // shown to the AI, e.g. "Durban"
  knowledgeFile: string; // file inside /knowledge
  teamId?: number; // Chatwoot team to assign on handover
  assigneeId?: number; // Chatwoot agent to assign on handover
};

const durban: Branch = {
  key: 'durban',
  name: 'Durban',
  knowledgeFile: 'durban.md',
  teamId: undefined, // FILL IN: "Durban Sales" team ID, e.g. 3
  assigneeId: undefined, // FILL IN: the Durban admin login's agent ID, e.g. 12345
};

const johannesburg: Branch = {
  key: 'johannesburg',
  name: 'Johannesburg',
  knowledgeFile: 'johannesburg.md',
  teamId: undefined, // FILL IN later: "Johannesburg Sales" team ID
  assigneeId: undefined, // FILL IN later: Johannesburg agent ID
};

const pretoria: Branch = {
  key: 'pretoria',
  name: 'Pretoria',
  knowledgeFile: 'pretoria.md',
  teamId: undefined, // FILL IN later: "Pretoria Sales" team ID
  assigneeId: undefined, // FILL IN later: Pretoria agent ID
};

export const BRANCHES_BY_INBOX: Record<number, Branch> = {
  // Bot Test inbox. PUT YOUR REAL BOT TEST INBOX ID BACK HERE (the one you used before).
  // Change "durban" to johannesburg or pretoria to test those branches.
  111111: durban,

  // Live WhatsApp inboxes. Remove the // at the start of a line on that branch's go-live day.
  // 222222: durban,       // Sunrose Online WhatsApp, 073 400 4991  (FILL IN inbox ID)
  // 333333: johannesburg, // Sunrose Johannesburg                   (FILL IN inbox ID)
  // 444444: pretoria,     // Sunrose Pretoria                       (FILL IN inbox ID)
};
