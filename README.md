# 🌱 Stardew Season Planner

A next-season planner for Stardew Valley 1.6. Tell it what equipment you have and
what you're after, and it tells you what to plant, what to build, what resources
you'll need, and the tricks worth knowing for your situation.

Data is seeded from the "Stardew Guide for 1.6" spreadsheet (sell prices, seed
prices, artisan values) and extended with the fields needed to compute real
returns: growth days, regrow interval (multi-harvest vs. replant-every-cycle),
average yield per harvest, and keg/jar/dehydrator processing times.

## Running it

It's a static site with zero dependencies — no build step.

```bash
# any static server works:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or enable GitHub Pages on this repo and it serves as-is.

## What it models

- **Harvests per season** from growth days, regrow interval, planting day, and
  speed modifiers (Speed-Gro tiers, Agriculturist).
- **Seed economics** — single-harvest crops re-buy seeds every cycle; regrowing
  crops buy once; special cases like coffee (seed bought once) and crops whose
  seeds can't be bought at all (carrot, broccoli, powdermelon — marked 🔒 and
  excluded from the auto-plan).
- **Quality** — expected quality multiplier from farming level + fertilizer,
  applied to raw sales only. Machines always output normal quality, so the right
  play (and the app's assumption) is: sell your gold/iridium raw, process the rest.
- **Processing** — wine (3x, ~7d), juice (2.25x, ~4d), jelly/pickles (2x+50, ~3d),
  dried (7.5x+25 per 5, 1d), plus fixed products: Pale Ale, Beer, Coffee, Green
  Tea, Raisins. Artisan (+40%) and Tiller (+10%) are applied where they count.
- **Machine capacity** — the plan only credits processing your kegs/jars/
  dehydrators can actually finish before season's end (each machine is a pool of
  machine-days); overflow is sold raw, and the resource card tells you how many
  machines to build (with material costs) for full throughput.
- **Budget & tiles** — greedy allocation on *achievable* profit, so a cheap-seed
  crop across all your tiles can beat a premium crop you can only afford 20 of.
- **Goals** — maximize profit, or set a gold target and see the tiles needed.
- **Tips & exploits** — a curated, situational list (Egg Festival strawberries,
  Rare Seed → Sweet Gem Berry, Ancient Fruit seed-maker loop, cask aging, Rain
  Totem winter fishing, giant crops...) filtered to your season and unlocks.

## Project layout

```
index.html      UI shell
css/style.css   styling
js/data.js      ALL game data: crops, processing rules, machine recipes, tips
js/calc.js      profit engine (pure functions, no DOM — testable in Node)
js/app.js       form → engine → rendered results
```

## Extending the data

Add a crop to `CROPS` in `js/data.js`:

```js
{ id: 'my_crop', name: 'My Crop', seasons: ['fall'], type: 'veg', // fruit|veg|flower|other
  seed: 50,        // seed price (0 = free/unpurchasable; add seedLimited: true if unbuyable)
  sell: 120,       // base sell price
  growth: 8,       // days to first harvest
  regrow: 3,       // days between harvests (null = single harvest, replant)
  yield: 1,        // avg items per harvest (blueberry = 3, potato ≈ 1.2)
  dry: true,       // dehydrator-eligible
  trellis: true,   // can't walk through
  kegOverride: { name: 'Special', price: 300, days: 2, inputs: 1 }, // fixed keg product
  seedNote: 'Where to buy it' }
```

Everything else (rankings, plan, machine math) picks it up automatically.

## Roadmap ideas

- Animals & artisan animal goods (the spreadsheet's ANIMAL rows: cheese, mayo, cloth, truffle oil)
- Fruit trees and honey/bee-house planning
- Multi-season planning (plant corn/wheat/sunflower across the summer→fall boundary)
- Cask aging planner (which bottles deserve your cask slots)
- Fish/cooking tabs from the rest of the spreadsheet
