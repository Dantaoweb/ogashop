# Oga Shop — Stage 1 Content (Customers, Events, Goods)

**Status:** draft v0.1 — for review
**Covers:** Levels 1–2 (The Table → The Shop)
**Goes with:** [PRD.md](PRD.md) sections 7, 8 and 14

All prices are in naira and are **estimates to check** with real traders before the Stage 1 test. All numbers marked *(tune)* are starting values for playtesting, not final.

---

## 1. Goods

| Item | Unit | Level | Buy | Sell | Expires | Notes |
|---|---|---|---|---|---|---|
| Rice | paint bucket | 1 | 2,000 | 2,500 | No | Best seller. Price-rise event target. |
| Garri | cup | 1 | 400 | 550 | No (gets damp in rain if not covered) | Cheap, sells often. |
| Sachet water | bag (20) | 1 | 350 | 500 | No | Sells fast in heat; runs out first. |
| Recharge card | ₦500 card | 1 | 480 | 500 | No | Low margin, high volume. Shows margin ≠ sales. |
| Noodles | pack | 2 | 250 | 320 | No | Counterfeit-event target. |
| Bread | loaf | 2 | 900 | 1,200 | **3 days** | Teaches expiry and overstocking. |
| Soft drinks | bottle | 2 | 300 | 400 | No | Sells better cold; power-outage target. |
| Palm oil | bottle (75cl) | 2 | 1,300 | 1,700 | No | Big buyers ask for it in bulk. |

**Start:** Level 1 begins with ₦20,000 cash and a small starter stock (5 rice, 10 garri, 4 water, 10 recharge cards).

**Level 2 unlocks:** the 4 new goods, supplier credit, receipts, debt reminders and the "Who owes you" screen.

---

## 2. Customer types

Five types. Each customer is a named person who is **remembered across days**: how you treat them changes how often they come back.

| Type | Example names | What they do | What the player learns | CreditVoice feature |
|---|---|---|---|---|
| **Regular** | Mama Bola, Mr Ade | Comes most days, buys the same few things, pays cash. Sometimes asks for small credit and pays on time. | Good service brings people back (loyalty). | Customer list |
| **Bargainer** | Aisha, Baba Kunle | Always asks for a discount. Walks away if refused about half the time. | Discounts cut profit; know your margin before you agree. | Profit per sale |
| **Credit asker** | Iya Tunde, Mr Okon | Wants part-payment now, rest later. Pays back if the sale was recorded and reminded. | Credit grows sales but carries risk; record and remind. | Debts and reminders |
| **Never pays** | Chidi | Asks for credit with a good story. Rarely pays, even when reminded. | Not every customer should get credit. Records show who to stop. | Debt history per customer |
| **Big buyer** | Pastor Femi, Madam Caro (caterer) | Rare. Wants a large order, often for an event. May ask for credit on a big amount. | Big orders need stock and cash flow; credit on a big order is a big risk. | Invoices (preview of Level 6) |

### Behaviour rules *(tune)*

| Rule | Value |
|---|---|
| Customers per day | Level 1: 6–8 · Level 2: 8–10 |
| Mix per day (Level 1) | 3 regular, 1–2 bargainer, 1 credit asker, 0–1 never-pays, big buyer rare (about 1 in 5 days) |
| Unrecorded credit: chance the customer "forgets" | 40% for regular and credit asker, 90% for never-pays |
| Recorded credit, no reminder: chance they pay on time | 60% (never-pays: 15%) |
| Recorded credit, reminded on due day: chance they pay on time | 85% (never-pays: 25%) |
| Refusing a regular | That customer skips the next 1–2 days |
| Running out of what a customer wants | Sale lost; regular's loyalty drops one step |
| Loyalty | 3 steps. Top step: comes daily and sometimes brings a friend (an extra customer). |

**Why these numbers:** the gap between "unrecorded" (about 36% paid on time: 40% forget, then 60% of the rest pay), "recorded" (60%) and "recorded + reminded" (85%) is the core lesson. A player who records and reminds should clearly end up with more money within 2–3 days.

---

## 3. Events (15)

One event per day, drawn from the deck for the player's level. No event repeats within 3 days. Each event has two or three choices; none of them is a trap. Every choice is recoverable.

| # | Event | Level | What happens | Choices | Lesson | CreditVoice link |
|---|---|---|---|---|---|---|
| 1 | **Rice price goes up** | 1 | Supplier: rice now ₦2,300, up from ₦2,000. | Raise price to ₦2,800 (some bargainers leave) · Keep ₦2,500 (profit per bucket drops to ₦200) | Know your margin; prices must follow costs. | Profit report |
| 2 | **Sister needs money** | 1 | Your sister asks for ₦3,000 from today's sales for school fees. | Give from the business money · Ask her to wait for your pay day (tiTi explains paying yourself a fixed amount) | Keep business money and personal money separate. | Expenses vs sales |
| 3 | **Heavy rain** | 1 | Rain all afternoon. Fewer customers. | Cover the garri (costs ₦300 for nylon) · Leave it (2 cups get damp and can't be sold) | Small costs protect stock. | Stock |
| 4 | **Hot day** | 1 | Very hot. Twice the usual demand for sachet water. | Buy 5 more bags now (₦1,750) · Sell what you have | Stock to demand; running out loses sales. | Low-stock alert |
| 5 | **Market levy** | 1 | Council collector asks for the ₦500 daily levy. | Pay ₦500 · Argue (lose time: one customer leaves) | Running costs reduce profit; record expenses too. | Expenses |
| 6 | **"I paid you already"** | 1 | Mr Ade says he paid off his ₦1,500 last week. | Check records (if recorded: the record shows he still owes; he pays) · Accept his word (you lose ₦1,500) | Records settle arguments. | Sales history |
| 7 | **Supplier bulk offer** | 1–2 | Supplier: buy 10 rice now at ₦1,800 each (₦18,000). | Take the deal (cash tied up for days) · Buy only what you need | Cheap stock is good only if you can afford it and sell it soon. | Stock and cash |
| 8 | **Neighbour cuts prices** | 1–2 | The stall next to you sells garri at ₦500. | Match ₦500 · Keep ₦550 and give better service · Stop selling garri | Competing on price is not the only way. | Profit per item |
| 9 | **Festive rush** (Christmas / Sallah) | 2 | Next 2 days: twice the customers, more big buyers. | Stock up now (uses cash or supplier credit) · Normal stock | Plan stock ahead of busy days. | Stock planning |
| 10 | **NEPA takes light** | 2 | No power for 2 days. Soft drinks are warm. | Pay ₦1,000/day to cool drinks at a neighbour's generator · Sell warm drinks ₦50 cheaper | Costs and prices change with conditions; work out which choice earns more. | Expenses |
| 11 | **Bread close to expiry** | 2 | 6 loaves expire tomorrow. | Sell at ₦900 today (no profit) · Keep full price (unsold loaves are thrown away) | Overstocking short-life goods wastes money. | Stock with expiry |
| 12 | **Cheap noodles offer** | 2 | A new seller offers noodles at ₦150 a pack (half price). | Buy 20 (they turn out fake: customers return them and two regulars stop coming) · Refuse | Very cheap stock from an unknown supplier is a risk. | Supplier list |
| 13 | **Customer relocates** | 2 | Iya Tunde is moving to Abuja. She owes you money. | Remind her today (if recorded: 70% she pays before leaving) · Do nothing (lost) | Chase debts early; records and reminders make it possible. | Reminders |
| 14 | **Stock goes missing** | 2 | You count your stock and 3 rice are missing. | Check records: if every sale was recorded, tiTi shows exactly what's missing and you find the cause (a "helper" took them) · No records: you can't tell how much is gone | Records reveal losses. Sets up staff honesty in Level 3. | Stock count vs sales |
| 15 | **Big order for a party** | 2 | Madam Caro wants 10 rice and 10 palm oil for a wedding: ₦42,000. She'll pay ₦20,000 now and ₦22,000 after the event. | Accept and record it with a due date · Ask for full payment (she may go elsewhere) · Refuse | Big credit is a big risk; always record terms and due date. | Invoices, debts |

### Event deck rules *(tune)*

- Level 1 deck: events 1–8. Level 2 deck: all 15, weighted toward 9–15.
- Events 2 and 6 always appear in Level 1 (first time each lesson is needed).
- Event 14 appears only after the player has played at least 3 Level 2 days.
- "Learning business" path: before the choice, tiTi adds one line explaining the idea (e.g. "Margin means what you keep from each sale after paying for the goods.").

---

## 4. tiTi tips (evening, one per day)

tiTi picks the tip that matches the player's biggest mistake that day. If there was none, it gives a praise line.

| Trigger | Tip |
|---|---|
| Credit given but not recorded | "You didn't record [name]'s credit. Some customers forget. Record every credit sale." |
| Ran out of an item | "[Item] ran out by [time]. Running out means lost sales. Buy a little more tomorrow." |
| Big money in, small profit | "Busy is not the same as profitable. Most of today's money only paid for your stock." |
| Discount below cost | "That discount on [item] cost you money. Your buy price was ₦[x]." |
| Used business money for personal things | "Business money paid for personal things today. Pay yourself a fixed amount instead." |
| Debt due today, no reminder sent | "[Name]'s debt is due today. A polite reminder gets paid more often than waiting." |
| Bread thrown away | "You threw away [n] loaves. Buy short-life goods in smaller amounts." |
| No mistakes | "Clean day! Every sale recorded and no stock ran out." |

## 5. "Did you know?" notes (learning path only)

Shown after the evening results, one per day, tied to the day's lesson.

1. **Cash vs profit:** Cash is all the money in your hand. Profit is what is left after you take away what your goods cost.
2. **Margin:** If you buy rice for ₦2,000 and sell for ₦2,500, your margin is ₦500 for each bucket.
3. **Record every sale:** A sale you don't write down is easy to forget, for you and for your customer.
4. **Credit:** Selling on credit means the customer takes the goods now and pays later. It can grow sales, but only if you get paid.
5. **Reminders:** A short, polite reminder on the due day is the easiest way to get your money back.
6. **Stock:** Too little stock loses sales. Too much ties up your cash or goes bad.
7. **Business vs personal money:** Pay yourself a fixed amount. Don't take from the till whenever you need money.
8. **Suppliers:** Supplier credit lets you buy now and pay later. It is a debt too: pay it on time to keep their trust.

---

## 6. Level goals *(tune)*

| Level | Goal to move up | Typical days |
|---|---|---|
| 1. The Table | ₦30,000 profit this level and a business score of 65 | about 12 days |
| 2. The Shop | ₦45,000 profit this level, a score of 70, and no debt more than 7 days late | about 13 days |

The PRD's example goal (₦100,000 profit and a score of 60) would take more than 30 in-game days from a ₦20,000 table, so the goals above are lower. Check them in playtesting against the 60% target for players finishing Level 1. Day counts come from `node tests/sim.mjs`, which plays 40 games with a bot that records every sale, restocks and reminds. A bot that records only half its sales takes about 19 days for Level 1; one that never records can't finish.

## 7. Business score *(draft weights)*

| Habit | Weight | How it is measured |
|---|---|---|
| Recording sales | 35% | Share of sales recorded with tiTi (credit sales count double) |
| Debt recovery | 25% | Share of money owed that was paid back on time |
| Stock management | 20% | Days with no stockouts and no thrown-away goods |
| Profit | 20% | Profit compared with the level's target |

The score moves slowly: at most ±6 points a day, so one bad day never wipes out good habits.

---

## 8. Open points for review

1. **Prices:** check every buy and sell price with traders in at least two markets.
2. **Names:** the customer names come from different regions on purpose; check that they feel familiar and respectful.
3. **Sister event (#2):** Stage 1 has no "pay yourself" setting; the second choice only explains the idea. Decide whether to add a real daily pay setting later.
4. **Generator (#10):** resolved for Stage 1: the player pays a neighbour to cool drinks, so owning a generator stays a Level 5 asset.
