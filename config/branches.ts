// Which Chatwoot inbox belongs to which branch.
//
// HOW TO FIND THE IDS (Chatwoot web app):
//   Inbox ID:  Settings > Inboxes > open the inbox > the number at the end of the URL
//   Team ID:   Settings > Teams > open the team > the number in the URL
//   Agent ID:  Settings > Agents > open the agent > the number in the URL
//
// Replace the placeholder numbers (111111, 222222, ...) with your real IDs.
// Any inbox NOT listed here is ignored by the bot.

export type BranchKey = 'durban' | 'johannesburg' | 'pretoria';

export type Branch = {
  key: BranchKey;
  name: string; // shown to the AI, e.g. "Durban"
  knowledgeFile: string; // file inside /knowledge
  teamId?: number; // Chatwoot team to assign on handover (preferred)
  assigneeId?: number; // or a single agent, if you don't use teams
};

const durban: Branch = {
  key: 'durban',
  name: 'Durban',
  knowledgeFile: 'durban.md',
  teamId: undefined, // e.g. 3
};

const johannesburg: Branch = {
  key: 'johannesburg',
  name: 'Johannesburg',
  knowledgeFile: 'johannesburg.md',
  teamId: undefined,
};

const pretoria: Branch = {
  key: 'pretoria',
  name: 'Pretoria',
  knowledgeFile: 'pretoria.md',
  teamId: undefined,
};

export const BRANCHES_BY_INBOX: Record<number, Branch> = {
  // "Bot Test" inbox: behaves like Durban while you test.
  // Change to johannesburg or pretoria to test the other branches.
  111111: durban,

  // Live WhatsApp inboxes: leave commented out until go-live day.
  // 222222: durban,       // Sunrose Durban (073 400 4991)
  // 333333: johannesburg, // Sunrose Johannesburg
  // 444444: pretoria,     // Sunrose Pretoria
};
