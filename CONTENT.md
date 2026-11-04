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
| Customers per day | Level 1: 5–6 · Level 2: 6–8 |
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
| 2 | **Family needs money** (repeats) | 1–2 | From Day 2. First time: your sister needs ₦3,000 for school fees. Later: mother's hospital bill, brother's transport, aunty's naming ceremony, rent, a church or mosque contribution (₦1,000–₦3,000). | Pay from my pocket · Take it from the business money · Not today | Keep business money and personal money separate: pay yourself a fixed amount and spend from that. | Expenses vs personal money |
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
| 1. The Table | ₦11,000 profit this level and a business score of 68 | 7-day target (about 6 with good habits) |
| 2. The Shop | ₦8,000 profit this level (after its rent and bills), a score of 70, and no debt more than 7 days late | 7-day target (about 7 with good habits) |

The PRD's example goal (₦100,000 profit and a score of 60) would take more than 30 in-game days from a ₦20,000 table, so the goals above are lower. Check them in playtesting against the 60% target for players finishing Level 1. Day counts come from `node tests/sim.mjs`, which plays 40 games with a bot that records every sale, restocks and reminds. A bot that records only half its sales takes about 19 days for Level 1; one that never records can't finish.

## 7. Business score *(draft weights)*

| Habit | Weight | How it is measured |
|---|---|---|
| Recording sales | 32% | Share of sales recorded with tiTi (credit sales count double) |
| Debt recovery | 20% | Share of money owed that was paid back on time |
| Stock management | 15% | Days with no stockouts and no thrown-away goods |
| Profit | 17% | Profit compared with the level's target |
| Money habits | 7% | Family needs paid from your pocket count for you; taking from the business money counts against |
| Happy customers | 9% | Complaints about prices raised during the day, trusted customers who leave when refused credit, and refused customers count against; good sales count for |

The score moves slowly: at most ±6 points a day, so one bad day never wipes out good habits.

---

## 7b. Daily pay *(tune)*

- The player sets a daily pay in the morning (starts at ₦1,000, steps of ₦500). Each evening it moves from the business cash to **Your pocket**.
- Family needs can be paid from the pocket. Taking from the business money lowers the Money habits score; paying from the pocket raises it.
- If the daily pay is more than the day's profit for 3 days running, tiTi warns that the business is paying out more than it earns.
- The evening **Money out** list shows business costs (lower profit) apart from personal money and pay (lower cash only).

## 7c. Running out during the day *(tune)*

- When a customer wants something you don't have (or not enough of), you can **send for more now**: normal buy price, at least 3 units, plus ₦300 transport (a business cost). The customer waits.
- Or say **sorry**: the sale is lost and that customer likes you less.
- The 2nd customer asking for the same missing item today: tiTi warns you.
- The 3rd: word spreads. Two regulars buy elsewhere for 2 days, and tomorrow 2 fewer customers come.
- Next morning, the stock list flags each item customers asked for and didn't get.

## 7d. Happy customers *(tune)*

- Prices can be changed during the day from the selling screen. Lowering is fine.
- After a raise, later buyers of that item may complain ("Ah! Rice was ₦2,500 this morning!"): regulars always, others 60% of the time. Bargainers who complain leave. When the raise follows a supplier price rise (event #1), it's milder: 50% and 30%.
- Each complaint lowers that customer's loyalty and counts against Happy customers.
- Refusing credit (cash only, and they leave, or Refuse) counts against you only for **trusted** customers: not the never-pays type, and nothing late or lost. Refusing an untrusted customer is shown as a good call and has no penalty.

## 7e. Big bills *(tune)*

- Bills are announced 3 days ahead in the morning, and paid from the business cash (a business cost) on the evening they are due.
- Level 1: market stall fee ₦3,000 every 7 days (Day 5, 12, …), so the short first level still meets one bill.
- Level 2: shop rent ₦8,000 every 7 days (first on the level's day 5), plus one-off bills: NEPA bill ₦2,500 (day 3) and padlock and door repair ₦2,000 (day 6).
- When buying stock would leave less cash than the bills due in the next 3 days, the buy box warns: "After buying you'll have ₦2,000, but the market stall fee (₦3,000) is due on Day 7." Buying is still allowed.
- An unpaid bill gets a ₦500 late fee every day until paid, and each late day counts against Money habits. Bills paid count for it.
- No borrowing in Stage 1 (loans are Level 5). A player short of cash can put their pocket money back into the business. A player with no stock and no money at all can start the level again.

## 7f. Savings goals

- Optional. The player picks something to save for, or types their own goal and price. Savings are the pocket (their daily pay).
- Real prices (estimates to check): school fees for one term ₦40,000 · smartphone ₦90,000 · sewing machine ₦120,000 · motorcycle (okada) ₦1,200,000 · plot of land ₦5,000,000 · keke ₦5,000,000 · used car ₦9,000,000 · bus ₦25,000,000 · house ₦35,000,000.
- The goal card shows progress and how long at the current pay ("about 16 years"). Over a year, it adds: grow the business to grow your pay.
- Family needs paid from the pocket say how many days later the goal comes. Putting pocket money into the business says it takes from the goal.
- When the pocket covers the price in the evening, the goal is bought: celebration and a Goal reached badge.

## 7g. Mini-game: Count the change *(tune)*

- At most once a day, a cash customer (35% chance per cash sale) pays with ₦1,000 notes, e.g. ₦2,000 for ₦1,650.
- The player taps ₦500, ₦200, ₦100 and ₦50 notes to make the change, then **Give change**. Undo is allowed.
- 15-second patience bar (not on the learning path, which also shows "Change = what they paid − the sale").
- Right change: counts for Happy customers. Too little: the customer demands the balance ("My balance is ₦50"), the player gives it from the till, and the customer is unhappy. Too much: the extra comes off profit. Too slow: the customer is unhappy.
- "Let tiTi count it" skips with no reward and no penalty. Skill only, no luck.

## 7h. Mini-game: Market run *(tune)*

- Offered only when a customer wants something you've run out of: a third choice next to "Send for more now" and "Sorry".
- 20 seconds, three lanes. Tap left or right (buttons or either side of the field). Catch the goods you need; puddles, okadas and wheelbarrows each cost 2 seconds. Slower for players who turn down motion on their phone.
- Catch everything: the goods at normal price and **no ₦300 transport fee**; the customer waited.
- Time runs out first: you keep (and pay for) what you caught, but the customer has left unhappy.
- "Send the boy instead" is always there, at the normal transport fee. Skill only, no luck prizes.

## 7i. Know your business: quiz and records

- Every sale goes in a sales log. **My records** (tiTi's screen and the top bar) shows, for this level: what sells most, each customer's visits and spending, and profit by day. Unrecorded sales are missing, and it says how many.
- **End-of-level quiz** before moving up: 4 questions about the player's own shop (most-sold goods, most loyal customer, who owes most, best profit per item, best day) and 2 lesson questions (profit vs cash, why record credit, family money, bills).
- Each shop question has **Check my records**: tiTi shows the answer from the records. The right answer uses what really happened, so unrecorded sales can make the records wrong.
- **Quick question** on about 1 evening in 3 (from the level's 3rd day): one shop question.
- Results are kept on the phone (for the Stage 1 test). 80% or better earns the **Know your business** badge. The quiz never blocks moving up and doesn't change the score.

## 7j. Mini-game: Spot the fake note *(tune)*

- Level 2 only, at most every 2 days: a cash sale (40% chance) is paid in 3 or 4 cartoon notes (₦1,000 green, ₦500 purple). They are simple drawings, not copies of real naira notes.
- 65% of the time one is fake, with a visible flaw: wrong colour, faded print, or no serial number. **Hold up to the light** shows the watermark and security thread on real notes only.
- Tap the fake note, or **All are real**. 15-second patience bar (none on the learning path, which also lists what to look for).
- Spotted the fake, or correctly "all real": counts for Happy customers, no loss. Missed a fake: its value is lost ("Fake note taken" in Money out). Called a real note fake: the customer is offended. Too slow: the customer is unhappy, and a fake is lost.
- "Let tiTi check" skips with no loss, no reward, no penalty.

## 7k. Payments: cash, transfer, card *(tune)*

- Mix of customers: Level 1 about 60% cash, 30% transfer, 10% card; Level 2 about 45% cash, 30% transfer, 25% card. Bargainers pay cash.
- Transfer: give your account number → "I've sent it" → check your account (credit alert) → done. Card: charge the amount on POS → approved.
- Settings → Payments: transfer account (CreditVoice account / another bank), account number (10 digits, default 0081234567) and POS (CreditVoice POS / another POS). **CreditVoice is the default.**
- All options work. With CreditVoice, tiTi records the sale automatically; with another bank or POS, the player types the record, and about half the days tiTi suggests switching to CreditVoice.
- Automatic records count in My records, debts and the quiz, but the recording score only counts sales the player had to record.
- Customers greet by the time of day: good morning (before 12), good afternoon (before 4 pm), good evening.

## 7l. Market run accident: broken leg *(tune)*

- In Market run, hitting a bicycle or okada has a 1 in 3 chance of a fall: "You broke your leg!" The goods drop and the waiting customer leaves.
- Getting to hospital: horse ₦2,000 (heals in 5 days), keke ₦3,000 (4 days), taxi ₦6,000 (3 days), ambulance ₦15,000 (2 days). Plus a ₦10,000 hospital bill.
- Paid from the pocket first (it's personal), then the business cash. What's left becomes a **hospital debt** due in 3 days, with the usual late fees.
- A bandage mark shows in the top bar while healing; running to the market is not possible until the leg heals, so the player sends the boy.
- tiTi's tip: running yourself saves ₦300 but an injury costs much more; savings help in emergencies.

## 7m. Level length and challenge days

- Every level has a **7-day target**. The top bar shows "Day 3 of 7 · 4 days left". Reaching the goal earlier moves you up straight away; if it isn't reached by Day 7, extra days follow ("Extra day 1") until it is.
- Days are shorter: 5–6 customers in Level 1, 6–8 in Level 2.
- Every other day of a level starts with an optional 2-minute **challenge**, rotating:
  - **Money check** (6 rounds): 4 notes of ₦100/₦200/₦500/₦1,000, old and new designs; spot the fake (wrong colour, faded print, no serial, no thread, too small, photocopy, "for movie use") or "all are real". Pass: 5 right. Reward: **Eagle eye** (the light check starts on in Spot the fake note).
  - **Road safety** (25 seconds): dodge bicycles, okadas and everything in the way. Pass: 3 bumps or fewer. Reward: **Fast runner** (Market run +5 seconds, half the accidents).
  - **Change master** (5 rounds, harder each time): "bought ₦3,465, gave ₦4,000": make the change with ₦1,000 down to ₦5. Pass: 4 right. Reward: **Patient customers** (+5 seconds to count change).
- Each pass earns a badge once. Skill only, always skippable.

## 7n. Rivals and the market *(tune)*

- Two rival shops (computer-run for now): **Emeka Stores** (market prices) and **Iya Basira's Stall** (about 5% cheaper). Real players can replace them once there's a server.
- Each morning shows **Market today**: about 3× your usual customers come to the market, shared between you and the rivals. Your share goes up or down with:
  - an **advert at your shop front**: ₦1,000 (Level 1) or ₦2,000 (Level 2) for 2 days, +35% customers (extra customers arrive the same day);
  - **lower or higher prices** than the market (up to ±30%);
  - **loyal customers** (up to +20%);
  - goods that **ran out yesterday** (−15%).
- A customer who leaves without buying (no stock, too expensive, refused, too slow…) goes to a rival, with a notice: "Ngozi went to Emeka Stores."
- The evening shows each shop's customers and sales, and who you lost to whom.

## 8. Open points for review

1. **Prices:** check every buy and sell price with traders in at least two markets.
2. **Names:** the customer names come from different regions on purpose; check that they feel familiar and respectful.
3. **Family needs (#2):** resolved: the player sets a daily pay and pays family needs from their pocket (section 7b).
4. **Generator (#10):** resolved for Stage 1: the player pays a neighbour to cool drinks, so owning a generator stays a Level 5 asset.
