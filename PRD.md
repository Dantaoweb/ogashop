# CreditVoice Business Game — Product Requirements (PRD)

**Name:** Oga Shop
**Status:** v1.0 — agreed, ready for design
**Owner:** CreditVoice
**Date:** 29 October 2026

---

## 1. Summary

A free, light, interactive business game where players grow a business from a small market table to a large company. Along the way they learn what CreditVoice does in real life: recording sales, credit and debt collection, stock, profit, staff, branches, financing and investors.

The game is a **separate product**, built and hosted apart from the CreditVoice app. CreditVoice only links to it. Nothing in the game can change or slow down the live app or its users' data.

## 2. Why we are building it

- **Teach by doing.** Most small business owners never read a guide. A game makes the habits stick: record every sale, chase debts, know your stock, separate business money from personal money.
- **Show what CreditVoice is for.** Every lesson mirrors a real CreditVoice feature, so a player understands the app before opening it.
- **Bring in users.** A player who learned why records matter is ready to try CreditVoice with their real business.
- **Partnerships.** Schools, NGOs, cooperatives and youth programmes can use it to teach business and money skills.

## 3. Goals and non-goals

**Goals**
1. Players learn the core money habits through play, not reading.
2. Each level teaches one clear business idea, mapped to a CreditVoice feature.
3. Sessions are short (2–5 minutes) and work on a cheap phone with little data.
4. A clear, gentle path from the game to CreditVoice ("Do this with your real shop").

**Non-goals (for now)**
- No real money in the game. No buying coins, no cash prizes, no betting-style rewards.
- No connection to a player's real CreditVoice records.
- No 3D, heavy graphics or large downloads.
- Not a replacement for CreditVoice. It teaches; the app does the work.

## 4. Who it is for

| Player | What they want | What the game gives them |
|---|---|---|
| Small business owners and traders | Practise running a business better without risk | Real situations: credit customers, price changes, staff, restocking |
| Young people and students | Learn business and money before starting one | A fun path from first sale to big company |
| Teachers, NGOs, cooperatives | A tool to teach business skills | Levels that match lessons; class progress (later) |

**Decided:** both. The player chooses at the start:

- **"I run a business"** — straight into the market, real-world situations, fewer explanations, faster days.
- **"I'm learning business"** — a gentler start, tiTi explains each new idea the first time it comes up, and short "Did you know?" notes after each day.

Both paths use the same levels and the same score, so friends can compare. The player can switch at any time in Settings. Teachers and NGOs use the "learning" path.

## 5. Design principles

1. **Lessons come from what happens, not from text.** If you sell on credit and never record it, the customer "forgets". The player feels the loss, then tiTi explains.
2. **Nigerian and real.** Familiar goods (rice, garri, sachet water, recharge cards), names, markets, prices in naira, everyday situations (NEPA, rain, festive rush, price hikes).
3. **Short and light.** A day is about 2 minutes. Loads fast on 3G; works offline once opened.
4. **Fair and kind.** Mistakes are recoverable. No punishing grind, no pay-to-win.
5. **One idea at a time.** New mechanics unlock only when the previous one is understood.
6. **Plain language.** Short sentences. Pidgin can come later as an option.

## 6. Core game loop (one in-game day)

1. **Morning — plan:** check cash, check stock, buy stock (cash or supplier credit), set prices.
2. **Selling — customers arrive:** each customer wants something. The player decides: sell for cash, give credit, give a discount, refuse.
3. **Record — tiTi:** the player records the sale by typing a short message, e.g. "sold 2 rice to Mama Bola 5000, paid 3000". This teaches the CreditVoice way of recording. Skipping it has consequences.
4. **Events:** something happens — a price rise, a customer who disappears, a thief, rain, a festival rush, a supplier offer.
5. **Evening — results:** money in, profit, stock left, who owes you. tiTi gives one tip.
6. **Score:** the business score moves up or down based on habits, not just cash.

## 7. Levels (full game)

| Level | Business size | What the player learns | CreditVoice feature it mirrors |
|---|---|---|---|
| 1. The Table | Small market table, ₦20,000 start | Cash vs profit; record every sale | Recording sales with tiTi |
| 2. The Shop | A small shop | Restocking, low stock, credit sales, chasing debts, receipts | Stock, debts and reminders, receipts |
| 3. Bigger Shop | Shop with staff | Hiring, staff honesty, expenses, pricing and margins | Staff accounts, expenses, profit reports |
| 4. Branches | Second and third branch | Delegation, comparing branches, stock per branch | Branches, permissions |
| 5. Money to Grow | Loans and partners | Asset finance, business score, investors and what giving away a share means | Business scorecard, financing, partners and investors |
| 6. Big Business | Wholesale or supermarket | Invoices, quotations, suppliers and purchase orders, VAT | Invoices, quotations, purchase orders, VAT |
| 7. Enterprise (later) | Mall or chain | Systems, data, scaling | Enterprise plan |

## 8. Key mechanics

**Money**
- Cash in hand, money owed to you (debtors), money you owe (suppliers).
- Profit is shown separately from cash, so players see that "busy" is not "profitable".

**Customers**
- Different types: regular, bargainer, credit asker, one who never pays, big buyer.
- Remembered across days. Good service brings them back (introduces loyalty).

**Credit and debts**
- Credit grows sales but carries risk.
- Unrecorded credit is "forgotten" by some customers.
- Reminders recover more money than doing nothing.

**Stock**
- Running out loses sales; overstocking ties up cash; some goods expire.

**Staff (Level 3+)**
- Staff save time but cost wages. Some are careless or dishonest; good records reveal it.

**Branches (Level 4+)**
- More sales, more to manage. Comparing branches shows which one to fix.

**Financing and investors (Level 5+)**
- A loan for an asset (freezer, generator) grows the business if repaid on time.
- The business score, built from good habits, decides what financing is offered.
- An investor gives cash for a share of profit. The player sees the long-term cost.

**Events**
- A deck of realistic events, chosen by level: price increases, power outage, rain, festive rush, a bad supplier, a counterfeit product, a customer who relocates owing money.

**tiTi in the game**
- The player's assistant: records sales from short messages, answers "who owes me", gives one tip per day.
- Uses the same style and words as CreditVoice, so the real app feels familiar.

## 9. Scoring and progress

- **Business score (0–100):** based on habits (recording rate, debt recovery, stock management, profit), not just cash. Mirrors the CreditVoice business scorecard.
- **Stars per day:** quick feedback.
- **Badges:** "Never lost a debt", "First branch", "Debt-free week", "Fully stocked".
- **Level up:** reach the level goal (e.g. "₦100,000 profit and a score of 60") to move to a bigger business.
- **Leaderboard (later):** among friends or a class, optional.
- **Share card (later):** "I reached Level 4 in Oga Shop" for WhatsApp status.

## 10. Accounts and saving

- **Play without an account.** Progress is saved on the device.
- **Optional sign-up** to save progress across phones and join a leaderboard or class.
- The game's accounts are **separate from CreditVoice accounts** in Stage 1. Linking the two (one login) can come later, only if it does not touch the live app's data.

## 11. Link with CreditVoice

- CreditVoice links to the game from:
  - the homepage (e.g. "Learn business by playing"),
  - the app menu (e.g. "Play & learn").
- The game links back to CreditVoice at natural moments, e.g. after Level 2: "Ready to do this with your real shop? Start free on CreditVoice."
- **No shared database, no shared code deploy.** A crash or mistake in the game cannot affect CreditVoice users.

## 12. Platform and technical requirements

- **Separate project:** its own folder and its own code repository.
- **Hosting (decided):** free hosting on **GitHub Pages** for now. Repository **`Dantaoweb/ogashop`**, so the game's address will be **https://dantaoweb.github.io/ogashop/**. A custom address (e.g. play.creditvoiceai.com) can be pointed at it later without rebuilding.
- **What GitHub Pages means for the build:** it serves files only — no server and no database. So Stage 1 must be a self-contained game: all game logic runs on the phone and progress is saved on the device. Accounts, leaderboards and classes need a small separate backend later; they are already outside Stage 1.
- **Web game** that runs in any phone browser; installable to the home screen.
- **Light:** first load under 1 MB target; simple illustrations and icons, no heavy assets.
- **Offline:** once opened, a day can be played without data; progress syncs when back online (if signed in).
- **Works on low-end Android phones** and small screens first; also on computers.
- **Languages:** English first; Pidgin, Yoruba, Hausa, Igbo later.
- **Data protection:** follows the Nigeria Data Protection Act. Collect as little as possible; nothing sold or shared.

## 13. Safety and trust

- No real money, no gambling mechanics (no spins, loot boxes or paid chances).
- Clearly a learning game, not an investment or loan product.
- Financing in the game is explained as fiction; the real CreditVoice note applies: CreditVoice does not lend money.
- Suitable for teenagers and adults. If school use is a priority, add a teacher mode without public chat.

## 14. Stage 1 — first release (to test the idea)

**Scope**
- The start screen: choose "I run a business" or "I'm learning business".
- Levels 1 and 2 only (Table → Shop).
- The core day loop: buy stock, serve customers, record with tiTi, evening results.
- 5 customer types, about 15 events.
- Business score, stars and a few badges.
- Play without an account, saved on the device.
- Links: from the CreditVoice homepage to the game, and from the game to "Start free on CreditVoice".

**Not in Stage 1:** accounts, leaderboards, classes, levels 3+, other languages.

**How we test it:** 20–50 real people (traders and young people), watched while they play. We learn what is fun, what is confusing, and whether they understood the lessons.

## 15. Success measures

| Measure | Stage 1 target |
|---|---|
| Players who finish Level 1 | 60% of those who start |
| Players who come back another day | 30% within a week |
| Players who can explain "profit vs cash" and "record every credit sale" after playing | 70% in a short quiz |
| Players who click through to CreditVoice | 10% |
| Average first load on 3G | Under 5 seconds |

## 16. Risks

| Risk | How we handle it |
|---|---|
| It feels like homework, not a game | Lessons come only from events; test with real players early |
| Too big to build | Stage 1 is two levels only; build more only if players enjoy it |
| Slow on cheap phones / costs data | Light assets, offline play, tested on low-end Android |
| Confused with gambling or a loan app | No real money, clear wording, fiction labelled as fiction |
| A game problem affects CreditVoice | Separate project, hosting and data; link only |

## 17. Open questions (need answers before design)

**Answered (29 Oct 2026):** both audiences, player chooses (section 4) · name **Oga Shop** · hosting on **GitHub Pages** for now (section 12).

**Also answered:** Stage 1 is **Levels 1–2 only** (Table → Shop) · **English first**; Pidgin and other languages later.

**Still open (does not block design):**
1. **Partners (optional):** any school, NGO or cooperative to test Stage 1 with? Not required to build — see note below.

**Answered:** GitHub repository `Dantaoweb/ogashop` → https://dantaoweb.github.io/ogashop/

*Note on partners:* a partner is not needed to design or build Stage 1. They help with: (1) real players for the Stage 1 test — a class or a cooperative meeting gives 20–50 testers in one place; (2) checking the lessons match what they teach (school business studies, NGO training); (3) getting the game to many people once it works; (4) credibility, and sometimes funding or sponsorship. Without one, Stage 1 is tested with CreditVoice users and people we know.

## 18. Next steps

1. Answer the open questions above.
2. Design: screen sketches for the day loop and Levels 1–2.
3. Write the event and customer list (content), with Nigerian prices and situations.
4. Build Stage 1 as a separate project.
5. Test with 20–50 real players; decide on the next stage.
