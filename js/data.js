// ============================================================
// Stardew Valley 1.6 data
// Prices seeded from the "Stardew Guide for 1.6" spreadsheet
// (base sell price, seed price, artisan values), augmented with
// growth/regrow days and processing times from game data so we
// can compute true per-season returns.
// ============================================================

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const DAYS_PER_SEASON = 28;

// Artisan product rules (1.6):
//   wine    = fruit,     3.00x base,  ~7 days in keg
//   juice   = vegetable, 2.25x base,  ~4 days in keg
//   jelly   = fruit,     2x base +50, ~3 days in jar
//   pickles = vegetable, 2x base +50, ~3 days in jar
//   dried   = 5 fruit/mushroom -> 7.5x base +25, 1 day in dehydrator
// Machines ignore input quality (output is always normal quality),
// so the optimal move is: sell your gold/iridium raw, process the rest.
export const PROCESS = {
  keg: { wine: { mult: 3, add: 0, days: 7 }, juice: { mult: 2.25, add: 0, days: 4 } },
  jar: { jelly: { mult: 2, add: 50, days: 3 }, pickles: { mult: 2, add: 50, days: 3 } },
  dehydrator: { dried: { mult: 7.5, add: 25, days: 1, batch: 5 } },
};

// Machine recipes for the resource calculator.
export const MACHINES = {
  keg: {
    label: 'Keg', unlock: 'Farming 8',
    materials: { Wood: 30, 'Copper Bar': 1, 'Iron Bar': 1, 'Oak Resin': 1 },
  },
  jar: {
    label: 'Preserves Jar', unlock: 'Farming 4',
    materials: { Wood: 50, Stone: 40, Coal: 8 },
  },
  dehydrator: {
    label: 'Dehydrator', unlock: "Pierre's (10,000g) or crafted",
    materials: { Wood: 30, Clay: 2, 'Fire Quartz': 1 },
  },
  cask: {
    label: 'Cask', unlock: 'Farmhouse cellar upgrade',
    materials: { Wood: 20, Hardwood: 1 },
  },
  qualitySprinkler: {
    label: 'Quality Sprinkler (waters 8)', unlock: 'Farming 6',
    materials: { 'Iron Bar': 1, 'Gold Bar': 1, 'Refined Quartz': 1 },
  },
  iridiumSprinkler: {
    label: 'Iridium Sprinkler (waters 24)', unlock: 'Farming 9',
    materials: { 'Gold Bar': 1, 'Iridium Bar': 1, 'Battery Pack': 1 },
  },
};

// type: 'fruit' | 'veg' | 'flower' | 'other'  (drives keg/jar product rules)
// regrow: null = single harvest, replant every cycle (seed cost per harvest)
// yield: average items per harvest (e.g. blueberry gives 3, potato ~1.2)
// seedOnce: seed survives / only bought once per season (coffee, sunflower note)
// kegOverride/jarOverride: fixed-price special products (beer, pale ale, coffee...)
// dry: eligible for dehydrator
// where: 'farm' | 'greenhouse' | 'island' — island crops need Ginger Island,
//        allSeason crops only make sense in the greenhouse (or on the island).
export const CROPS = [
  // ---------------- SPRING ----------------
  { id: 'strawberry', name: 'Strawberry', seasons: ['spring'], type: 'fruit',
    seed: 100, sell: 120, growth: 8, regrow: 4, yield: 1.02, dry: true,
    seedNote: 'Egg Festival (Spring 13) only — stock up for next year!' },
  { id: 'rhubarb', name: 'Rhubarb', seasons: ['spring'], type: 'fruit',
    seed: 100, sell: 220, growth: 13, regrow: null, yield: 1, dry: true, shop: 'oasis',
    seedNote: 'Sold at the Oasis (Desert)' },
  { id: 'cauliflower', name: 'Cauliflower', seasons: ['spring'], type: 'veg',
    seed: 80, sell: 175, growth: 12, regrow: null, yield: 1, giant: true },
  { id: 'potato', name: 'Potato', seasons: ['spring'], type: 'veg',
    seed: 50, sell: 80, growth: 6, regrow: null, yield: 1.2 },
  { id: 'kale', name: 'Kale', seasons: ['spring'], type: 'veg',
    seed: 70, sell: 110, growth: 6, regrow: null, yield: 1 },
  { id: 'garlic', name: 'Garlic', seasons: ['spring'], type: 'veg',
    seed: 40, sell: 60, growth: 4, regrow: null, yield: 1 },
  { id: 'parsnip', name: 'Parsnip', seasons: ['spring'], type: 'veg',
    seed: 20, sell: 35, growth: 4, regrow: null, yield: 1 },
  { id: 'green_bean', name: 'Green Bean', seasons: ['spring'], type: 'veg',
    seed: 60, sell: 40, growth: 10, regrow: 3, yield: 1, trellis: true },
  { id: 'carrot', name: 'Carrot', seasons: ['spring'], type: 'veg',
    seed: 0, sell: 35, growth: 3, regrow: null, yield: 1.6, seedLimited: true,
    seedNote: 'Carrot seeds: dropped by digging artifact spots / Raccoon trades (not sold)' },
  { id: 'blue_jazz', name: 'Blue Jazz', seasons: ['spring'], type: 'flower',
    seed: 30, sell: 50, growth: 7, regrow: null, yield: 1 },
  { id: 'tulip', name: 'Tulip', seasons: ['spring'], type: 'flower',
    seed: 20, sell: 30, growth: 6, regrow: null, yield: 1 },
  { id: 'unmilled_rice', name: 'Unmilled Rice', seasons: ['spring'], type: 'veg',
    seed: 40, sell: 30, growth: 8, regrow: null, yield: 1,
    seedNote: 'Grows in 6 days if planted next to water; mill into Rice (100g)' },
  { id: 'coffee_spring', name: 'Coffee Bean', seasons: ['spring', 'summer'], type: 'other',
    seed: 2500, sell: 15, growth: 10, regrow: 2, yield: 4, seedOnce: true,
    kegOverride: { name: 'Coffee', price: 150, days: 0.1, inputs: 5 },
    seedNote: 'Traveling Cart (~2,500g) or dust sprite drop; beans are also the seed' },

  // ---------------- SUMMER ----------------
  { id: 'starfruit', name: 'Starfruit', seasons: ['summer'], type: 'fruit',
    seed: 400, sell: 750, growth: 13, regrow: null, yield: 1, dry: true, shop: 'oasis',
    seedNote: 'Sold at the Oasis (Desert)' },
  { id: 'blueberry', name: 'Blueberry', seasons: ['summer'], type: 'fruit',
    seed: 80, sell: 50, growth: 13, regrow: 4, yield: 3.02, dry: true },
  { id: 'melon', name: 'Melon', seasons: ['summer'], type: 'fruit',
    seed: 80, sell: 250, growth: 12, regrow: null, yield: 1, giant: true, dry: true },
  { id: 'red_cabbage', name: 'Red Cabbage', seasons: ['summer'], type: 'veg',
    seed: 100, sell: 260, growth: 9, regrow: null, yield: 1,
    seedNote: 'Pierre year 2+; year 1 via Traveling Cart' },
  { id: 'hops', name: 'Hops', seasons: ['summer'], type: 'veg',
    seed: 60, sell: 25, growth: 11, regrow: 1, yield: 1, trellis: true,
    kegOverride: { name: 'Pale Ale', price: 300, days: 2, inputs: 1 } },
  { id: 'wheat', name: 'Wheat', seasons: ['summer', 'fall'], type: 'veg',
    seed: 10, sell: 25, growth: 4, regrow: null, yield: 1,
    kegOverride: { name: 'Beer', price: 200, days: 2, inputs: 1 } },
  { id: 'hot_pepper', name: 'Hot Pepper', seasons: ['summer'], type: 'fruit',
    seed: 40, sell: 40, growth: 5, regrow: 3, yield: 1, dry: true },
  { id: 'tomato', name: 'Tomato', seasons: ['summer'], type: 'fruit',
    seed: 50, sell: 60, growth: 11, regrow: 4, yield: 1.05 },
  { id: 'radish', name: 'Radish', seasons: ['summer'], type: 'veg',
    seed: 40, sell: 90, growth: 6, regrow: null, yield: 1 },
  { id: 'summer_squash', name: 'Summer Squash', seasons: ['summer'], type: 'veg',
    seed: 0, sell: 45, growth: 6, regrow: 3, yield: 1, seedLimited: true,
    seedNote: 'Seeds from Raccoon trades (not sold)' },
  { id: 'poppy', name: 'Poppy', seasons: ['summer'], type: 'flower',
    seed: 100, sell: 140, growth: 7, regrow: null, yield: 1 },
  { id: 'spangle', name: 'Summer Spangle', seasons: ['summer'], type: 'flower',
    seed: 50, sell: 90, growth: 8, regrow: null, yield: 1 },
  { id: 'sunflower', name: 'Sunflower', seasons: ['summer', 'fall'], type: 'flower',
    seed: 200, sell: 80, growth: 8, regrow: null, yield: 1,
    seedNote: 'JojaMart sells seeds for 125g; drops 0-2 extra seeds on harvest' },
  { id: 'corn', name: 'Corn', seasons: ['summer', 'fall'], type: 'veg',
    seed: 150, sell: 50, growth: 14, regrow: 4, yield: 1,
    seedNote: 'Spans two seasons — plant in summer, harvest through fall' },
  { id: 'pineapple', name: 'Pineapple', seasons: ['summer'], type: 'fruit', where: 'island',
    seed: 240, sell: 300, growth: 14, regrow: 7, yield: 1, dry: true,
    seedNote: 'Ginger Island trade (magma cap); grows any season on the island' },
  { id: 'taro', name: 'Taro Root', seasons: ['summer'], type: 'veg', where: 'island',
    seed: 20, sell: 100, growth: 10, regrow: null, yield: 1,
    seedNote: 'Ginger Island trade (bone fragments); no watering needed near water' },

  // ---------------- FALL ----------------
  { id: 'pumpkin', name: 'Pumpkin', seasons: ['fall'], type: 'veg',
    seed: 100, sell: 320, growth: 13, regrow: null, yield: 1, giant: true },
  { id: 'cranberries', name: 'Cranberries', seasons: ['fall'], type: 'fruit',
    seed: 240, sell: 75, growth: 7, regrow: 5, yield: 2.1, dry: true },
  { id: 'artichoke', name: 'Artichoke', seasons: ['fall'], type: 'veg',
    seed: 30, sell: 160, growth: 8, regrow: null, yield: 1,
    seedNote: 'Pierre year 2+' },
  { id: 'beet', name: 'Beet', seasons: ['fall'], type: 'veg',
    seed: 20, sell: 100, growth: 6, regrow: null, yield: 1, shop: 'oasis',
    seedNote: 'Sold at the Oasis (Desert); 1 beet -> 3 sugar in the Mill' },
  { id: 'yam', name: 'Yam', seasons: ['fall'], type: 'veg',
    seed: 60, sell: 160, growth: 10, regrow: null, yield: 1 },
  { id: 'amaranth', name: 'Amaranth', seasons: ['fall'], type: 'veg',
    seed: 70, sell: 150, growth: 7, regrow: null, yield: 1 },
  { id: 'grape', name: 'Grape', seasons: ['fall'], type: 'fruit',
    seed: 60, sell: 80, growth: 10, regrow: 3, yield: 1, trellis: true, dry: true,
    dryOverride: { name: 'Raisins', price: 600, days: 1, inputs: 5 } },
  { id: 'eggplant', name: 'Eggplant', seasons: ['fall'], type: 'veg',
    seed: 20, sell: 60, growth: 5, regrow: 5, yield: 1.002 },
  { id: 'bok_choy', name: 'Bok Choy', seasons: ['fall'], type: 'veg',
    seed: 50, sell: 80, growth: 4, regrow: null, yield: 1 },
  { id: 'fairy_rose', name: 'Fairy Rose', seasons: ['fall'], type: 'flower',
    seed: 200, sell: 290, growth: 12, regrow: null, yield: 1,
    seedNote: 'Fairy Rose honey sells for 680g — great with bee houses' },
  { id: 'broccoli', name: 'Broccoli', seasons: ['fall'], type: 'veg',
    seed: 0, sell: 70, growth: 8, regrow: 4, yield: 1, seedLimited: true,
    seedNote: 'Seeds from Raccoon trades (not sold)' },
  { id: 'gem_berry', name: 'Sweet Gem Berry', seasons: ['fall'], type: 'other',
    seed: 1000, sell: 3000, growth: 24, regrow: null, yield: 1, seedLimited: true,
    seedNote: 'Rare Seed — Traveling Cart only (Fri/Sun, usually 1 per visit), so you can\'t fill a field. Plant the handful you\'ve collected as a bonus. Cannot be processed.' },

  // ---------------- WINTER ----------------
  { id: 'powdermelon', name: 'Powdermelon', seasons: ['winter'], type: 'fruit',
    seed: 0, sell: 60, growth: 7, regrow: null, yield: 1, giant: true, dry: true, seedLimited: true,
    seedNote: 'Seeds from winter artifact spots / Raccoon trades; the only outdoor winter crop' },

  // ------------- GREENHOUSE / ANY-SEASON -------------
  { id: 'ancient_fruit', name: 'Ancient Fruit', seasons: ['spring', 'summer', 'fall'], type: 'fruit',
    where: 'greenhouse-or-farm', seed: 0, sell: 550, growth: 28, regrow: 7, yield: 1, dry: true, seedLimited: true,
    seedNote: 'Seed from artifacts/Seed Maker — multiply via Seed Maker loop. 28-day growth: only worth it in the greenhouse or planted spring day 1.' },
  { id: 'cactus', name: 'Cactus Fruit', seasons: [], type: 'fruit', where: 'greenhouse',
    seed: 150, sell: 75, growth: 12, regrow: 3, yield: 1, dry: true,
    seedNote: 'Greenhouse/indoor only' },
  { id: 'tea', name: 'Tea Leaves', seasons: ['spring', 'summer', 'fall'], type: 'other',
    seed: 100, sell: 50, growth: 21, regrow: 1, yield: 1,
    kegOverride: { name: 'Green Tea', price: 100, days: 0.2, inputs: 1 },
    seedNote: 'Tea sapling (crafted: wild seeds + fiber). Only produces the last 7 days of each season; permanent bush.' },
];

// ---------------- Tips & exploits ----------------
// when(ctx) receives the full input state and returns true if relevant.
export const TIPS = [
  {
    title: 'Egg Festival strawberry rush',
    when: c => c.season === 'spring',
    body: 'Strawberry seeds are ONLY sold at the Egg Festival (Spring 13). Planted Spring 14 you get 2 harvests; with Speed-Gro or Agriculturist you squeeze out a 3rd. Even better: buy hundreds and hold them until Spring 1 next year for 5 harvests each.',
  },
  {
    title: 'Rare Seed → Sweet Gem Berry (3,000g)',
    when: c => c.season === 'fall' || c.season === 'summer',
    body: 'The Traveling Cart (Fri/Sun, Cindersap Forest) sells Rare Seeds for 600-1,000g — but usually just one per visit, and its stock rotates, so treat them as a side bet, not a field crop: buy one whenever you see one and stockpile. Plant by Fall 4 (24-day growth). Each berry sells for 3,000g base — and giving one to Old Master Cannoli earns a Stardrop.',
  },
  {
    title: 'Ancient Fruit seed-maker loop',
    when: c => c.equipment.greenhouse,
    body: 'Run harvested Ancient Fruit through a Seed Maker (avg ~2 seeds each) to exponentially fill your greenhouse. A full greenhouse of Ancient Fruit (116 plants) harvested weekly and kegged into wine (1,650g, 2,310g with Artisan) is the classic end-game money printer.',
  },
  {
    title: 'Starfruit wine is the gold-per-keg king',
    when: c => c.season === 'summer' && c.equipment.kegs > 0,
    body: 'Starfruit (750g) → wine = 2,250g, or 3,150g with the Artisan profession. Buy seeds at the Oasis. Age to iridium in casks for 6,300g a bottle.',
  },
  {
    title: 'Casks double your best wine',
    when: c => c.equipment.casks > 0,
    body: 'Iridium-aged wine sells for 2x. Only age your most valuable bottles (Starfruit, Ancient Fruit): full aging takes 2 full seasons (56 days), so cheap wine wastes cask time.',
  },
  {
    title: 'Preserves jars beat kegs for cheap crops',
    when: c => c.equipment.jars > 0 || c.equipment.kegs > 0,
    body: 'Jars give 2x+50g in ~3 days vs. wine 3x in ~7 days. For anything selling under ~100g raw (blueberries, cranberries, hot peppers), the jar earns more gold per machine-day. The ranking table below already accounts for this.',
  },
  {
    title: 'Dehydrator: 1-day turnaround (1.6)',
    when: c => c.equipment.dehydrators > 0,
    body: 'Dried fruit = 7.5x base + 25g for 5 fruit, ready the next morning. Grapes are special: 5 grapes → Raisins (600g). Great overflow for berry crops when kegs are full.',
  },
  {
    title: 'Hops → Pale Ale treadmill',
    when: c => c.season === 'summer' && c.equipment.kegs >= 10,
    body: 'Hops regrow daily (up to 17/season). Pale Ale is 300g (420g Artisan) per hop on a 2-day keg cycle. Highest gold/day/tile in the game if you have the keg wall to absorb it — expect a lot of clicking.',
  },
  {
    title: 'Giant crops',
    when: c => ['spring', 'summer', 'fall', 'winter'].includes(c.season),
    body: 'Cauliflower, Melon, Pumpkin and Powdermelon planted in 3x3 blocks can fuse into giant crops that yield 15-21 items when chopped. Leave them standing — they never rot and double as decoration.',
  },
  {
    title: "Bear's Knowledge berry weeks",
    when: c => c.season === 'spring' || c.season === 'fall',
    body: "Salmonberry week (Spring 15-18) and Blackberry week (Fall 8-11) are free money with Bear's Knowledge (3x sell price: 15g/60g each). Shake every bush; hundreds of berries in 4 days.",
  },
  {
    title: 'Winter: Powdermelon + prep season',
    when: c => c.season === 'winter',
    body: "Powdermelon (1.6) is the only outdoor winter crop — seeds drop from winter artifact spots. Winter is also for: Night Market (Winter 15-17), mining for machine materials, crab pot lines, and stockpiling seeds for the Spring 1 mega-plant.",
  },
  {
    title: 'Rain Totem cheese for winter fish',
    when: c => c.season === 'winter',
    body: 'Walleye and Red Snapper normally need rain, but a Rain Totem used in winter makes it rain the next day — the only way to catch them in winter (your Fish tab already flags these with "T").',
  },
  {
    title: 'Fairy Rose honey',
    when: c => c.season === 'fall',
    body: 'Bee houses within 5 tiles of a blooming Fairy Rose make Fairy Rose Honey (680g, 952g Artisan) every 4 days. Flowers only need to be alive, not harvested.',
  },
  {
    title: 'Wheat gap-filler',
    when: c => c.season === 'summer' || c.season === 'fall',
    body: 'Wheat grows in 4 days for 10g a seed and spans summer AND fall — plant it in any gap (even Summer 25-28, harvest in fall). With kegs it becomes 200g Beer; with a Mill, flour.',
  },
  {
    title: 'Ginger Island: no seasons',
    when: c => c.equipment.island,
    body: 'The island farm ignores seasons entirely — Pineapple (regrows every 7 days) and any-season crops run year-round. Pineapple seeds cost 1 Magma Cap at the island trader.',
  },
  {
    title: 'Coffee: plant once, caffeinate forever',
    when: c => c.season === 'spring',
    body: 'Coffee beans planted in spring regrow every 2 days (4 beans/harvest) through summer. 5 beans keg into Coffee (150g) almost instantly, and Coffee + Oil + Sugar = Triple Shot Espresso (450g, big speed buff). One Traveling Cart bean (~2,500g) becomes a permanent supply.',
  },
];
