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

Run the simulation after changing numbers in `js/data.js` to check that pacing stays on target (about 12 days for Level 1 and 13 for Level 2 with good habits) and that a player who never records cannot finish Level 1.

## Publish on GitHub Pages

1. Create the repository `Dantaoweb/ogashop` and push these files to the `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the game is live at https://dantaoweb.github.io/ogashop/.

All paths are relative, so the same files also work later on a custom address such as play.creditvoiceai.com.

**When you change any file:** bump `VERSION` in `sw.js` (e.g. `ogashop-v2`). Otherwise players who already have the game cached keep the old version.

## Before the Stage 1 test

- Check all prices in `js/data.js` with traders (see CONTENT.md section 8).
- `CREDITVOICE_URL` in `js/data.js` is a guess (`https://creditvoiceai.com`). Set it to the real sign-up link.
- Add the "Learn business by playing" link on the CreditVoice homepage and app menu (PRD section 11).
- The PRD's success measures (finish rate, return rate, click-through) need some analytics. Stage 1 sends nothing anywhere; decide on a privacy-friendly counter that fits the Nigeria Data Protection Act before the test.
