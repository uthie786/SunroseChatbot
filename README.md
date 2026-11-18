# Sunrose Chatbot

WhatsApp AI assistant for Sunrose. Chatwoot sends each new customer message to this app; the app asks Claude what to do, then replies, hands the chat to the right branch, or closes junk.

Everything runs on GitHub + Vercel. Nothing needs to be installed on your computer.

## How it works

1. Customer messages a branch WhatsApp number -> it lands in that branch's Chatwoot inbox.
2. Chatwoot calls `/api/chatwoot` (the Agent Bot webhook).
3. The bot waits a few seconds (so quick double messages get one answer), checks the chat is still bot-owned (`pending`), and reads the history.
4. It asks Claude (or the mock, see below) for a decision:
   - **reply**: posts the answer
   - **hand_over**: posts a goodbye line, adds labels, writes a summary note, sets the chat to `open`, assigns the branch team
   - **close_junk**: labels `junk` and resolves the chat
5. If anything fails, the chat is opened for a person with a `bot-error` label. Customers are never left hanging.

## Files

| File | What it is |
| --- | --- |
| `app/api/chatwoot/route.ts` | The webhook Chatwoot calls |
| `lib/handler.ts` | The main flow (steps 3 to 5) |
| `lib/chatwoot.ts` | Chatwoot API helpers |
| `lib/claude.ts` | Claude call and the two tools |
| `lib/mock.ts` | Fake AI for testing without credits |
| `config/branches.ts` | Inbox ID -> branch, team |
| `prompts/system.md` | The assistant's rules |
| `knowledge/*.md` | Company and branch knowledge (fill in the TODOs) |

## Setup

### 1. GitHub
1. Create a **private** repo called `sunrose-chatbot`.
2. Unzip this project and drag all its files and folders into GitHub's **Add file > Upload files** page. Commit.

### 2. Vercel
1. **Add New > Project**, import `sunrose-chatbot`. Framework: Next.js (auto-detected).
2. Add environment variables (see `.env.example`). For now: `BOT_MODE=mock`, `CHATWOOT_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_ADMIN_TOKEN`, `WEBHOOK_SECRET`.
3. Deploy. Open `https://<your-app>.vercel.app/api/chatwoot` and you should see `{"ok":true,...}`.

### 3. Chatwoot
1. Create a test inbox: **Settings > Inboxes > Add inbox > Website**, name it `Bot Test`. Note its inbox ID.
2. Create the bot: **Settings > Bots > Add bot**, name `Sunrose Assistant`, webhook URL
   `https://<your-app>.vercel.app/api/chatwoot?secret=<WEBHOOK_SECRET>`. Copy the bot's access token.
3. In Vercel add `CHATWOOT_BOT_TOKEN`, then redeploy.
4. Connect the bot to **Bot Test only**: open the inbox settings > **Bot configuration** > choose Sunrose Assistant.
5. Create labels: `lead`, `after-sales`, `junk`, `bot-error`, `aircon`, `butchery`, `refrigeration`, `catering`, `bakery`, `combo-deal`, `other-product`.
6. Put the Bot Test inbox ID in `config/branches.ts` (replace `111111`) and add team IDs if you use teams.

### 4. Test in mock mode (free)
Open the Bot Test inbox's website widget (inbox settings show a preview link / embed code) and send:

| Send | Expect |
| --- | --- |
| `hello` | `Mock reply: hello` |
| `can I speak to a person` | Goodbye line, labels, summary note, chat moves to Open and is assigned |
| `ok` | Chat labelled `junk` and resolved |
| `error` | `bot-error` note, chat opened for a person |

Watch **Vercel > Logs** for lines starting with `[bot]`.

### 5. Go live with Claude
1. Buy a small amount of credit in the Claude Console, create an API key.
2. In Vercel set `ANTHROPIC_API_KEY` and `BOT_MODE=live`, redeploy.
3. Run the full test list from the build plan.
4. Go-live day: put the real inbox IDs in `config/branches.ts`, disconnect Captain from that inbox, connect Sunrose Assistant instead.

## Notes
- The bot only acts on **pending** chats. Once a person has the chat (open), it stays silent. Use **Take over** in Chatwoot any time.
- Logs never include customer message text (POPIA).
- Keep the knowledge files short. Very large prompts (over 100,000 tokens) cost 5x more on Haiku.
