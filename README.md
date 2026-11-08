# Oga Shop

A free business learning game by CreditVoice. Players grow from a ₦20,000 market table to a shop, and learn to record every sale, manage stock and collect debts.

- Product requirements: [PRD.md](PRD.md)
- Customers, events, goods and tuning numbers: [CONTENT.md](CONTENT.md)

This is **Stage 1**: Levels 1–2, the full day loop, 5 customer types, 15 events, business score, stars and badges. No accounts; progress is saved on the device.

## How it is built

Plain HTML, CSS and JavaScript modules. No build step and no dependencies, so GitHub Pages can serve the files as they are. About 120 KB in total, with no web fonts or images except the app icon.

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `css/style.css` | All styles |
| `js/data.js` | Goods, customers, rules, level goals, tiTi text. **Edit content and tuning here.** |
| `js/events.js` | The 15 events |
| `js/parser.js` | tiTi reading messages like "sold 2 rice to Mama Bola 5000, paid 3000" |
| `js/core.js` | Shared money, stock and debt helpers |
| `js/engine.js` | Day loop, customers, debts, score, badges, levels |
| `js/art.js` | Cartoon customers, goods, table and shop (drawn in code) |
| `js/voice.js` | Customers speaking, using the phone's own voice |
| `js/run.js` | Market run mini-game (browser only) |
| `js/bills.js`, `js/goals.js` | Big bills; savings goals |
| `js/analytics.js`, `worker/` | Player counting, and its small server |
| `js/ui.js` | Screens |
| `js/main.js` | Saving, screen switching, button handling |
| `sw.js` | Offline support (caches the game after the first visit) |
| `manifest.webmanifest`, `icons/` | "Add to home screen" |

The game logic (`data`, `core`, `events`, `parser`, `engine`) has no browser code, so it runs in Node for tests.

## Run it locally

Any static file server works; it must be served over http (not opened as a file) because it uses JavaScript modules.

```
python -m http.server 8080
```

Then open http://localhost:8080/.

## Tests

Needs Node 18 or newer.

```
npm test             # unit tests: tiTi parser, engine rules, every event choice
node tests/sim.mjs   # plays 40 games per habit profile and prints days to finish each level
```

Run the simulation after changing numbers in `js/data.js` to check that pacing stays on target (about 6–7 days for each level with good habits) and that a player who never records cannot finish Level 1.

## Publish on GitHub Pages

1. Create the repository `Dantaoweb/ogashop` and push these files to the `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the game is live at https://dantaoweb.github.io/ogashop/.

All paths are relative, so the same files also work later on a custom address such as play.creditvoiceai.com.

**When you change any file:** bump `VERSION` in `sw.js` (e.g. `ogashop-v2`). Otherwise players who already have the game cached keep the old version.

## Player counting

The game sends nothing until `ANALYTICS_URL` in `js/data.js` is set. Three modes, chosen by the player (`js/analytics.js`):

- **No / not answered:** anonymous totals. No code, no cookies.
- **Yes:** the same totals, plus a random player code with level, day and score.
- **Don't count me:** nothing is sent.

Names, phone numbers, sales, account numbers and custom customer text are never sent, and the server never stores IP addresses.

To connect it, from the `worker/` folder with a free Cloudflare account:

```
npx wrangler login
npx wrangler d1 create ogashop            # put the database_id in wrangler.toml
npx wrangler d1 execute ogashop --remote --file=schema.sql
npx wrangler secret put STATS_KEY         # a long password for the results page
npx wrangler deploy
```

Set `ANALYTICS_URL` to `https://<your-worker-address>/e`, bump `VERSION` in `sw.js`, and push. Results: `https://<your-worker-address>/stats?key=<STATS_KEY>`.

## Before the Stage 1 test

- Check all prices in `js/data.js` with traders (see CONTENT.md section 8).
- `CREDITVOICE_URL` in `js/data.js` points to the CreditVoice homepage (`https://creditvoiceai.com`). Check that it is the right address.
- Oga Shop is a separate project. Nothing here changes the CreditVoice app or website: CreditVoice adds its own link to the game from its side, if and when it chooses.
- Connect the player counter (below) so the PRD's success measures can be seen. Have the privacy wording checked against the Nigeria Data Protection Act before a big launch.
