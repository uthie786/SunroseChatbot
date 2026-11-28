# Sunrose Chatbot

WhatsApp AI assistant for Sunrose. Chatwoot sends each new customer message to this app. The app asks Claude (Haiku) what to do, then **replies**, **hands the chat to the right branch** with labels and a summary, or **closes junk**.

Everything runs on GitHub + Vercel. Nothing needs to be installed on a computer. To change a file: open it on GitHub, click the pencil, paste, **Commit changes**, wait for Vercel to show **Ready**.

---

## Status (28 Nov 2026)

| Branch | WhatsApp | Chatwoot inbox | Inbox ID | Handovers go to | Status |
| --- | --- | --- | --- | --- | --- |
| Durban (Overport) | 073 400 4991 | Sunrose DUR WhatsApp | set in `config/branches.ts` | Admin login ("Mine") | **Live** |
| Johannesburg | 081 891 1862 | Sunrose Johannesburg | 158482 | Sunrose JHB agent (286504) | **Live** |
| Pretoria | 060 144 6390 | not connected yet | - | not set | **Blocked by Meta** (see Known issues) |
| Bot Test (website widget) | - | Bot Test | 157844 | Durban rules | Testing only |

Chatwoot account ID: 197221. Captain (Chatwoot's built-in AI) is switched off on all live inboxes.

---

## How it works

1. A customer messages a branch WhatsApp number. The message lands in that branch's Chatwoot inbox as **Pending**.
2. Chatwoot calls `/api/chatwoot?secret=...` (the Agent Bot webhook).
3. The bot:
   - only acts on **incoming** messages in **Pending** chats, in inboxes listed in `config/branches.ts`
   - waits a few seconds (`DEBOUNCE_MS`) so quick double messages get one answer
   - **stays silent in old chats**: if the chat started more than `BOT_MAX_CHAT_AGE_HOURS` ago (default 12), it labels it `returning`, adds a note, opens it and assigns the branch, without replying
   - turns **WhatsApp catalogue orders** into readable text (items, quantities, estimated total)
   - hands **voice notes, photos and files** straight to staff (the bot can't read them)
   - reads **Click-to-WhatsApp ad** details (headline, text) so it knows which Sunrose ad the customer tapped
   - adds the current **date, time and open/closed status** (South Africa, incl. public holidays)
4. Claude decides:
   - **reply**: answers from the knowledge and asks only for missing details (name, product, quantity, use)
   - **hand_over**: sends a closing message, adds labels, writes a **Bot summary** private note, sets **Open**, assigns the branch login
   - **close_junk**: labels `junk` and resolves
5. **Every handover message ends with "Prefer to visit or call?"**: address, two phone numbers and a Google Maps link for the relevant branch (added by code, so it's never missed). After hours it also shows trading hours.
6. If Claude returns nothing, the bot retries once and forces a handover. If anything still fails, the customer gets a holding message, and staff get a `bot-error` label and note.

---

## Files

| File | What it is |
| --- | --- |
| `app/api/chatwoot/route.ts` | Webhook Chatwoot calls. Also the ID lookup page (see below) |
| `lib/handler.ts` | The main flow (all the steps above) |
| `lib/claude.ts` | Claude call, the `hand_over` / `close_junk` tools, empty-reply retry |
| `lib/chatwoot.ts` | Chatwoot API helpers (reply, notes, labels, status, priority, assign, ID lookup) |
| `lib/ad.ts` | Finds Click-to-WhatsApp ad details |
| `lib/order.ts` | Finds WhatsApp catalogue orders |
| `lib/knowledge.ts` | Builds the prompt: rules + shared + hardware + branch knowledge |
| `lib/mock.ts` | Fake AI for free testing (`BOT_MODE=mock`) |
| `lib/types.ts` | Handover reasons and product labels |
| `config/branches.ts` | **Inbox ID -> branch**, and who gets each branch's handovers |
| `config/hours.ts` | Trading hours and SA public holidays |
| `config/locations.ts` | **Branch addresses, phone numbers, map links** for the "visit or call" block |
| `prompts/system.md` | The assistant's rules and situations |
| `knowledge/shared.md` | Company info, branch locations, product ranges, **current specials**, FAQs, payment, delivery |
| `knowledge/hardware.md` | Sunrose Wholesalers (Springfield): Maestro paints, hardware, building, decor |
| `knowledge/durban.md`, `johannesburg.md`, `pretoria.md` | Branch-specific info |

---

## What the bot handles

| Situation | What it does | Labels |
| --- | --- | --- |
| Buying enquiry | Answers, asks once for missing details, hands over | `lead` + product |
| Customer asks a question mid-way (e.g. "branch in Gauteng?") | Answers first, re-asks for details (max twice), then hands over | |
| Combo deals / specials | Gives price from knowledge, Ts & Cs, stock not guaranteed | `lead`, `combo-deal` |
| Came from a **Sunrose ad** | Treats the ad as a confirmed offer, never asks for a screenshot | `lead` + product |
| Deal **not** in the knowledge | Never confirms it; hands over for a consultant to check | `lead`, `deal-check` |
| Date-limited deal (e.g. Black Friday only) | Before: "available on that date"; after: "that special has ended" | |
| Bulk / trade order | Never quotes trade prices; collects products, quantities, area, date | `lead`, `bulk-order`, high priority |
| Order status | Asks for order number, gives 067 090 4774 | `order-status` |
| After-sales / faults / returns | Apologises, collects invoice, product, problem, photo; safety warning if dangerous | `after-sales` |
| Catalogue order | Repeats items and estimated total, collects details | `lead` + product |
| Voice note / photo / file | Hands straight to staff | `lead`, `other-product` |
| Old chat reopened | Silent, passed to staff | `returning` |
| Spam, "ok", "thanks" | Closes | `junk` |
| Bot failure | Holding message to customer | `bot-error` |

**Product labels:** `snowbros`, `butcherbros`, `bakerbros`, `caterbros`, `aircon`, `chillbros`, `combo-deal`, `spares`, `maestro`, `hardware`, `other-product`.
**Status labels:** `lead`, `after-sales`, `order-status`, `bulk-order`, `deal-check`, `returning`, `junk`, `bot-error`.
Each must exist in Chatwoot (**Settings > Labels**) to show with a colour.

**Which branch the "visit or call" block shows:** the chat's own branch by default. In Durban chats: Springfield for hardware/Maestro, Overport for commercial equipment. If the customer is elsewhere or asks about another branch: Durban/KZN = both Durban branches, Johannesburg area = JHB, Pretoria/Tshwane = PTA, Gauteng = both, other provinces = online orders line.

---

## Common jobs

### Update prices, specials or products
Edit `knowledge/shared.md` (commercial equipment) or `knowledge/hardware.md`. Short bullet points.
For a deal with dates, write them in: e.g. `R49,999, BLACK FRIDAY ONLY: valid on Friday 27 November 2026 only`. The bot checks today's date.

### Change a branch address or phone number
Edit `config/locations.ts` (the handover block) **and** `knowledge/shared.md` > Branch locations (what the bot says in chat).

### Find inbox and agent IDs
- Inbox ID: **Settings > Inboxes**, click the inbox, number at the end of the address bar.
- Agent IDs (and all IDs): open the bot's webhook URL with `&list=ids` on the end:
  `https://<your-app>.vercel.app/api/chatwoot?secret=<WEBHOOK_SECRET>&list=ids`
  Don't share this link: it contains the secret.

### Connect a new branch inbox
1. Connect the number in Chatwoot (**Add Inbox > WhatsApp > Quick setup**, on a laptop with ad blockers off). Turn off the WhatsApp Business app's greeting message and any Meta AI on that phone.
2. Leave **Bot Configuration** on None.
3. Create the branch agent login (role Agent), add it as collaborator on that inbox only.
4. In `config/branches.ts`: add `<inboxId>: <branch>,` to `BRANCHES_BY_INBOX`, and set that branch's `assigneeId`.
5. Wait for **Ready**, then set **Bot Configuration > Sunrose Assistant** and test from a phone.

### Switch the bot off for an inbox (rollback)
Chatwoot > **Settings > Inboxes > (inbox) > Bot Configuration > None**. Staff carry on manually.

### Check what the bot did
**Vercel > Logs**, filter `[bot]`. Useful lines: `replied`, `handed over (...)`, `came from an ad`, `catalogue order`, `returning customer`, `ignoring inbox` (inbox not in `branches.ts`), `empty Claude response`.

---

## Environment variables (Vercel > Settings > Environment Variables)

| Name | What |
| --- | --- |
| `BOT_MODE` | `live` (Claude) or `mock` (free testing) |
| `ANTHROPIC_API_KEY` | Claude API key (Sunrose's Console organisation for production) |
| `CLAUDE_MODEL` | Optional. Default `claude-haiku-5-5` |
| `CHATWOOT_URL` | `https://app.chatwoot.com` |
| `CHATWOOT_ACCOUNT_ID` | `197221` |
| `CHATWOOT_BOT_TOKEN` | Sunrose Assistant bot token |
| `CHATWOOT_ADMIN_TOKEN` | Admin login's access token (Durban "Mine" uses this login) |
| `WEBHOOK_SECRET` | Must match `?secret=` in the bot's webhook URL |
| `DEBOUNCE_MS` | Optional. Default 4000 |
| `BOT_MAX_CHAT_AGE_HOURS` | Optional. Default 12. Older chats go to staff without a bot reply |

After changing a variable: **Deployments > (latest) > Redeploy**. Never redeploy an old deployment.

---

## Staff setup

- Staff use **one shared login per branch** (Durban uses the admin login).
- On phones, use Chatwoot **in the browser saved to the home screen** (Safari on iPhone, Chrome on Android), not the Chatwoot app: the app can't show custom folders. Guide graphic: "Save Chatwoot to your Home Screen" (iPhone + Android).
- Turn on push in **Profile settings > Notifications** from inside the home-screen icon. Keep "assigned to you" and "new message in assigned conversation" on; turn "new conversation created" off.
- Folders (custom views) belong to the login that creates them. Name them `DBN · Leads`, `JHB · After-sales` etc. The home-screen app always opens on the main screen; folders are in the ☰ menu.
- Staff cheat sheet: separate doc.

---

## Known issues and open items

- **Pretoria not connected.** Number shows "Ineligible" / "connected to Meta Business Agent" in Quick setup even though no AI replies are visible. Its WhatsApp Business App messaging account in the Sunrose Online Pretoria portfolio is under Meta review. Retry Quick setup once the review clears; if it still fails, try the setup with a Facebook login that only has the Pretoria portfolio. Then add the inbox ID and agent ID to `config/branches.ts`.
- **Catalogue orders:** Meta sends product codes, not names. Need a catalogue export (Commerce Manager CSV) to map codes to names. Check logs for `catalogue order` vs `empty message, attributes`.
- **Unknown number "N" (+27 71 078 8084)** registered under Sunrose Group. Confirm with Sunrose what it is.
- **Per-salesperson alerts** (e.g. Aslam only gets construction leads) without extra Chatwoot seats: planned via Telegram groups or email, mapped by label.
- **Move hosting to Sunrose's own Vercel account** (Pro for commercial use) and their own Claude Console key with auto-reload and a spend limit.
- Confirm with Sunrose: Price Beat and Refunds summaries, public holiday hours, branch TODOs in the knowledge files, whether Springfield also sells commercial equipment.
- Second Vercel project under the `sunrosewholesale` account (never deployed): delete or set up properly before moving hosting.

## Notes
- The bot only acts on **Pending** chats. Once a person has the chat (Open), it stays silent.
- Logs don't include customer message text. The debug lines for ads and catalogue orders log the raw ad/order attributes only.
- Keep the knowledge files short: the whole prompt is cached, and very large prompts cost more.
