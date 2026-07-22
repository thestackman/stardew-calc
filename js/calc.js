// ============================================================
// Profit engine: turns crop data + the player's setup into
// ranked per-season strategies with resource requirements.
// ============================================================

import { CROPS, PROCESS, DAYS_PER_SEASON } from './data.js';

// --- Growth time with Speed-Gro / Agriculturist -------------
// Game stacks speed modifiers additively, then reduces total
// growth days (spread across phases; this is a close approximation).
const SPEED = { none: 0, speedgro: 0.10, deluxe: 0.25, hyper: 0.33 };

export function effectiveGrowth(crop, ctx) {
  let bonus = SPEED[ctx.speedGro] || 0;
  if (ctx.agriculturist) bonus += 0.10;
  return Math.max(1, Math.ceil(crop.growth * (1 - bonus)));
}

// --- Harvest counts inside the remaining days ---------------
// Plant on day `startDay` (1-28). First harvest lands after
// `growth` days; regrowing crops then repeat every `regrow` days,
// single-harvest crops are replanted the same day.
export function harvestCount(crop, ctx) {
  const growth = effectiveGrowth(crop, ctx);
  const daysLeft = DAYS_PER_SEASON - ctx.startDay + 1; // inclusive of today
  const usable = daysLeft - 1; // growth consumes days before first harvest
  if (growth > usable) return { harvests: 0, plantings: 0, growth };
  if (crop.regrow) {
    const harvests = 1 + Math.floor((usable - growth) / crop.regrow);
    return { harvests, plantings: 1, growth };
  }
  const harvests = Math.floor(usable / growth);
  return { harvests, plantings: crop.seedOnce ? 1 : harvests, growth };
}

// --- Expected quality multiplier for RAW sales --------------
// Approximates the game's quality roll from farming level +
// fertilizer tier. Machines ignore quality, so this only
// applies to raw-sold crops. Flowers/forage excluded for simplicity.
const FERT_LEVEL = { none: 0, basic: 1, quality: 2, deluxe: 3 };

export function qualityMultiplier(ctx) {
  const lvl = ctx.farmingLevel;
  const fert = FERT_LEVEL[ctx.fertilizer] || 0;
  let gold = 0.2 * (lvl / 10) + 0.2 * fert * ((lvl + 2) / 12) + 0.01;
  gold = Math.min(gold, 1);
  let iridium = 0;
  if (fert === 3) { iridium = gold / 2; }
  const silver = Math.min(0.75, gold * 2) * (1 - gold - iridium);
  const pGold = gold * (1 - iridium);
  const base = Math.max(0, 1 - iridium - pGold - silver);
  return iridium * 2 + pGold * 1.5 + silver * 1.25 + base * 1;
}

// --- Value of one item through each processing route --------
// Returns {route, product, value, machineDays, inputsPerRun}
export function processingRoutes(crop, ctx) {
  const artisan = ctx.artisan ? 1.4 : 1;
  const routes = [];

  // Keg
  if (crop.kegOverride) {
    routes.push({
      route: 'keg', product: crop.kegOverride.name,
      valuePerItem: (crop.kegOverride.price * artisan) / (crop.kegOverride.inputs || 1),
      machineDays: crop.kegOverride.days, inputs: crop.kegOverride.inputs || 1,
    });
  } else if (crop.type === 'fruit') {
    const p = PROCESS.keg.wine;
    routes.push({ route: 'keg', product: 'Wine', valuePerItem: crop.sell * p.mult * artisan, machineDays: p.days, inputs: 1 });
  } else if (crop.type === 'veg') {
    const p = PROCESS.keg.juice;
    routes.push({ route: 'keg', product: 'Juice', valuePerItem: crop.sell * p.mult * artisan, machineDays: p.days, inputs: 1 });
  }

  // Preserves jar
  if (crop.type === 'fruit') {
    const p = PROCESS.jar.jelly;
    routes.push({ route: 'jar', product: 'Jelly', valuePerItem: (crop.sell * p.mult + p.add) * artisan, machineDays: p.days, inputs: 1 });
  } else if (crop.type === 'veg') {
    const p = PROCESS.jar.pickles;
    routes.push({ route: 'jar', product: 'Pickles', valuePerItem: (crop.sell * p.mult + p.add) * artisan, machineDays: p.days, inputs: 1 });
  }

  // Dehydrator (fruit only, or explicit override e.g. raisins)
  if (crop.dryOverride) {
    routes.push({
      route: 'dehydrator', product: crop.dryOverride.name,
      valuePerItem: (crop.dryOverride.price * artisan) / crop.dryOverride.inputs,
      machineDays: crop.dryOverride.days, inputs: crop.dryOverride.inputs,
    });
  } else if (crop.dry) {
    const p = PROCESS.dehydrator.dried;
    routes.push({
      route: 'dehydrator', product: 'Dried',
      valuePerItem: (crop.sell * p.mult + p.add) * artisan / p.batch,
      machineDays: p.days, inputs: p.batch,
    });
  }
  return routes;
}

// --- Full evaluation of one crop for the given setup --------
export function evaluateCrop(crop, ctx) {
  const { harvests, plantings, growth } = harvestCount(crop, ctx);
  if (harvests === 0) return null;

  const itemsPerTile = harvests * crop.yield;
  const seedCostPerTile = plantings * crop.seed;
  const tillerMult = ctx.tiller && crop.type !== 'other' ? 1.1 : 1;
  const qMult = crop.type === 'flower' || crop.type === 'other' ? 1 : qualityMultiplier(ctx);

  const rawPerItem = crop.sell * qMult * tillerMult;
  const rawProfit = itemsPerTile * rawPerItem - seedCostPerTile;

  // Best processing route per item. The "processed/tile" figure assumes
  // unlimited machines (a what-if); actual machine capacity is applied
  // when building the plan.
  // All routes, best value first; ties break toward the faster machine
  // cycle (blueberry jelly = wine at 210g, but a jar turn is 3 days
  // vs the keg's 7 — jars win).
  const routes = processingRoutes(crop, ctx)
    .sort((a, b) => b.valuePerItem - a.valuePerItem || a.machineDays - b.machineDays);
  const best = routes[0] || null;
  const machineOwned = { keg: ctx.equipment.kegs, jar: ctx.equipment.jars, dehydrator: ctx.equipment.dehydrators };
  // Routes the player can run TODAY (owns the machine, beats raw), best
  // first. The plan fills these in order and sells the overflow raw.
  const ownedRoutes = routes.filter(r => machineOwned[r.route] > 0 && r.valuePerItem > rawPerItem);
  const processedProfit = best ? itemsPerTile * best.valuePerItem - seedCostPerTile : null;
  const useProcessing = ownedRoutes.length > 0;

  const daysUsed = DAYS_PER_SEASON - ctx.startDay + 1;
  const profit = useProcessing
    ? itemsPerTile * ownedRoutes[0].valuePerItem - seedCostPerTile
    : rawProfit;

  return {
    crop, harvests, plantings, growth, ownedRoutes,
    itemsPerTile: round2(itemsPerTile),
    seedCostPerTile,
    rawPerItem,
    rawProfit: Math.round(rawProfit),
    bestRoute: best,
    processedProfit: processedProfit !== null ? Math.round(processedProfit) : null,
    recommendProcessing: useProcessing,
    profitPerTile: Math.round(profit),
    goldPerTileDay: round2(profit / daysUsed),
  };
}

// --- Candidate list for the season / unlocks ----------------
export function candidates(ctx) {
  return CROPS.filter(c => {
    if (c.where === 'island' && !ctx.equipment.island) return false;
    if (c.where === 'greenhouse' && !ctx.equipment.greenhouse) return false;
    if (c.shop === 'oasis' && !ctx.equipment.desert) return false;
    const inSeason = c.seasons.includes(ctx.season);
    const greenhouseOk = ctx.equipment.greenhouse && (c.where === 'greenhouse' || c.where === 'greenhouse-or-farm' || c.seasons.length > 0);
    if (ctx.location === 'greenhouse') return greenhouseOk;
    return inSeason;
  });
}

export function rankCrops(ctx) {
  return candidates(ctx)
    .map(c => evaluateCrop(c, ctx))
    .filter(Boolean)
    .sort((a, b) => b.goldPerTileDay - a.goldPerTileDay);
}

// --- Machine-pool allocation --------------------------------
// Profit if we plant `n` tiles of `r`, given what's left of a
// machine-day pool (not mutated). Items flow into the best owned
// route until its pool runs dry, then the next owned route, then
// sell raw — so 25 jars still matter when you own 0 kegs.
function allocWithPool(r, n, machinePool) {
  const items = n * r.itemsPerTile;
  let remaining = items, revenue = 0;
  const used = [];
  for (const route of r.ownedRoutes) {
    if (remaining <= 0) break;
    const perItem = route.machineDays / route.inputs;
    const can = perItem > 0
      ? Math.min(remaining, Math.floor(machinePool[route.route] / perItem))
      : remaining;
    if (can <= 0) continue;
    revenue += can * route.valuePerItem;
    used.push({ r: route, items: can });
    remaining -= can;
  }
  revenue += remaining * r.rawPerItem;
  return {
    items, used,
    processedItems: items - remaining,
    profit: revenue - n * r.seedCostPerTile,
  };
}

// --- Build the recommended plan under budget/tile limits ----
// Greedy: pour tiles into the best crop the budget allows; the
// first planting must fit the budget (later replants are funded
// by harvest revenue). Crops with unpurchasable seeds (seedLimited)
// are skipped — the ranking table still shows them.
// Processing is capped by real machine capacity: each machine
// contributes a pool of machine-days; items beyond the pool sell raw.
export function buildPlan(ranked, ctx) {
  const plan = { allocations: [], totalProfit: 0, totalSeedCost: 0, tilesUsed: 0 };
  let tiles = ctx.tiles;
  let budget = ctx.budget;
  const daysLeft = DAYS_PER_SEASON - ctx.startDay + 1;
  const machinePool = {
    keg: ctx.equipment.kegs * daysLeft,
    jar: ctx.equipment.jars * daysLeft,
    dehydrator: ctx.equipment.dehydrators * daysLeft,
  };

  const tryAlloc = (r, n) => allocWithPool(r, n, machinePool);

  // Greedy on ACHIEVABLE profit: each round, pick the crop that earns
  // the most total gold given remaining tiles, budget, and machines
  // (a budget-bound cheap crop can beat a pricier "better" one).
  while (tiles > 0 && plan.allocations.length < 3) {
    let best = null;
    for (const r of ranked) {
      if (r.crop.seedLimited) continue;
      if (plan.allocations.some(a => a.result === r)) continue;
      const affordable = r.crop.seed > 0 ? Math.floor(budget / r.crop.seed) : tiles;
      const n = Math.min(tiles, affordable);
      if (n <= 0) continue;
      const attempt = tryAlloc(r, n);
      if (attempt.profit <= 0) continue;
      if (!best || attempt.profit > best.attempt.profit) best = { r, n, attempt };
    }
    if (!best) break;

    const { r, n, attempt } = best;
    for (const u of attempt.used) {
      machinePool[u.r.route] -= u.items * (u.r.machineDays / u.r.inputs);
    }
    const alloc = {
      result: r, tiles: n,
      seedCost: n * r.crop.seed,
      totalSeeds: n * r.plantings,
      profit: Math.round(attempt.profit),
      items: Math.round(attempt.items),
      used: attempt.used,
      processedItems: Math.round(attempt.processedItems),
      rawItems: Math.round(attempt.items - attempt.processedItems),
    };
    plan.allocations.push(alloc);
    plan.totalProfit += alloc.profit;
    plan.totalSeedCost += alloc.seedCost;
    plan.tilesUsed += n;
    tiles -= n;
    budget -= alloc.seedCost;
  }
  plan.machinePoolLeft = machinePool;
  return plan;
}

// --- Mid-season replanting ----------------------------------
// The first planting is often budget-bound, leaving tiles idle. As
// harvests sell and machines finish, cash frees up — this walks the
// season's estimated income timeline and plants follow-up waves on
// the idle tiles whenever one is affordable AND can still finish
// before the season ends. Cash timing: raw items pay on harvest day,
// processed items pay when the machine finishes, and single-harvest
// replant seeds are paid out of that day's take.
export function planFollowUps(plan, ctx) {
  const tilesFree = ctx.tiles - plan.tilesUsed;
  const out = { waves: [], extraProfit: 0, tilesFree };
  if (!plan.allocations.length || tilesFree <= 0) return out;

  const events = [];
  for (const a of plan.allocations) {
    const r = a.result;
    const H = r.harvests;
    for (let h = 0; h < H; h++) {
      const day = ctx.startDay + r.growth + h * (r.crop.regrow || r.growth);
      if (day > DAYS_PER_SEASON) break;
      if (a.rawItems > 0) events.push({ day, cash: (a.rawItems / H) * r.rawPerItem });
      for (const u of a.used || []) {
        events.push({ day: Math.ceil(day + u.r.machineDays), cash: (u.items / H) * u.r.valuePerItem });
      }
      if (!r.crop.regrow && !r.crop.seedOnce && h < H - 1) {
        events.push({ day, cash: -a.tiles * r.crop.seed });
      }
    }
  }
  events.sort((x, y) => x.day - y.day);

  let cash = ctx.budget - plan.totalSeedCost;
  let free = tilesFree;
  const pool = { ...plan.machinePoolLeft };
  for (const e of events) {
    cash += e.cash;
    if (free <= 0 || out.waves.length >= 3) break;
    const day = e.day + 1; // plant the next morning
    if (day >= DAYS_PER_SEASON) break;
    const subCtx = { ...ctx, startDay: day };
    let best = null;
    for (const r of rankCrops(subCtx)) {
      if (r.crop.seedLimited) continue;
      const affordable = r.crop.seed > 0 ? Math.floor(cash / r.crop.seed) : free;
      const n = Math.min(free, affordable);
      if (n <= 0) continue;
      const attempt = allocWithPool(r, n, pool);
      if (attempt.profit <= 0) continue;
      if (!best || attempt.profit > best.attempt.profit) best = { r, n, attempt };
    }
    if (!best) continue;
    const { r, n, attempt } = best;
    for (const u of attempt.used) {
      pool[u.r.route] -= u.items * (u.r.machineDays / u.r.inputs);
    }
    out.waves.push({
      day, result: r, tiles: n,
      cashBefore: Math.round(cash),
      seedCost: n * r.crop.seed,
      profit: Math.round(attempt.profit),
      items: Math.round(attempt.items),
      used: attempt.used,
      processedItems: Math.round(attempt.processedItems),
      rawItems: Math.round(attempt.items - attempt.processedItems),
      totalSeeds: n * r.plantings,
    });
    out.extraProfit += Math.round(attempt.profit);
    cash -= n * r.crop.seed;
    free -= n;
  }
  return out;
}

// --- Machine requirements for the plan ----------------------
// How many machines you'd need to process the ENTIRE harvest within
// the season (summed across crops sharing the same machine type).
export function machineNeeds(plan, ctx) {
  const needs = { keg: 0, jar: 0, dehydrator: 0 };
  const daysLeft = DAYS_PER_SEASON - ctx.startDay + 1;
  for (const a of plan.allocations) {
    const r = a.result;
    if (!r.bestRoute || r.bestRoute.valuePerItem <= r.rawPerItem) continue;
    const route = r.bestRoute;
    const runsPerMachine = Math.max(1, Math.floor(daysLeft / Math.max(route.machineDays, 0.1)));
    const totalRuns = Math.ceil(a.items / route.inputs);
    needs[route.route] += Math.ceil(totalRuns / runsPerMachine);
  }
  return needs;
}

// --- Upgrade advisor -----------------------------------------
// "What should I build?" Re-plans the season as if kegs/jars/
// dehydrators were unlimited, then reports how many of each you'd
// have to ADD to actually capture that harvest, the season-profit
// gain, and a cask plan for the ageable keg output.
export const CASK_AGING = { Wine: 56, Beer: 28, 'Pale Ale': 34 }; // days to iridium (2x value)
export const CELLAR_CAPACITY = 125; // casks that fit in the cellar with walk space

export function upgradeAdvisor(ctx, currentPlan) {
  const daysLeft = DAYS_PER_SEASON - ctx.startDay + 1;
  const uncapped = { ...ctx, equipment: { ...ctx.equipment, kegs: 1e9, jars: 1e9, dehydrators: 1e9 } };
  const idealPlan = buildPlan(rankCrops(uncapped), uncapped);
  if (!idealPlan.allocations.length) return null;

  const needs = machineNeeds(idealPlan, uncapped);
  const owned = { keg: ctx.equipment.kegs, jar: ctx.equipment.jars, dehydrator: ctx.equipment.dehydrators };

  // Per-machine rows: how many to add, and what ONE extra machine of
  // that type earns over the season (full-throughput margin of the
  // best crop flowing through that route).
  const machines = [];
  for (const route of ['keg', 'jar', 'dehydrator']) {
    const need = needs[route];
    const add = Math.max(0, need - owned[route]);
    let gainPerMachine = 0, product = null;
    for (const a of idealPlan.allocations) {
      for (const u of a.used) {
        if (u.r.route !== route) continue;
        const runs = Math.max(1, Math.floor(daysLeft / Math.max(u.r.machineDays, 0.1)));
        const g = runs * u.r.inputs * (u.r.valuePerItem - a.result.rawPerItem);
        if (g > gainPerMachine) { gainPerMachine = g; product = u.r.product; }
      }
    }
    machines.push({ route, need, owned: owned[route], add, gainPerMachine: Math.round(gainPerMachine), product });
  }

  // Season-profit delta if everything recommended gets built.
  const upgraded = { ...ctx, equipment: { ...ctx.equipment,
    kegs: Math.max(owned.keg, needs.keg),
    jars: Math.max(owned.jar, needs.jar),
    dehydrators: Math.max(owned.dehydrator, needs.dehydrator) } };
  const upgradedPlan = buildPlan(rankCrops(upgraded), upgraded);
  const gain = Math.max(0, upgradedPlan.totalProfit - currentPlan.totalProfit);

  // Casks: iridium-aging doubles wine/beer/pale ale, so each aged
  // bottle adds its full (artisan-adjusted) value. Fill the cellar
  // with the most valuable bottles first.
  const ageable = [];
  for (const a of upgradedPlan.allocations) {
    for (const u of a.used) {
      if (u.r.route !== 'keg') continue;
      const agingDays = CASK_AGING[u.r.product];
      if (!agingDays) continue;
      const bottles = Math.floor(u.items / u.r.inputs);
      if (bottles > 0) {
        ageable.push({ product: u.r.product, bottles,
          bottleValue: u.r.valuePerItem * u.r.inputs, agingDays });
      }
    }
  }
  ageable.sort((x, y) => y.bottleValue - x.bottleValue);
  let capacity = CELLAR_CAPACITY;
  const aged = [];
  let caskBottles = 0, caskGain = 0;
  for (const b of ageable) {
    const n = Math.min(b.bottles, capacity);
    if (n <= 0) break;
    capacity -= n; caskBottles += n; caskGain += n * b.bottleValue;
    aged.push({ ...b, bottles: n });
  }
  const cask = {
    bottles: caskBottles,
    add: Math.max(0, caskBottles - ctx.equipment.casks),
    owned: ctx.equipment.casks,
    gain: Math.round(caskGain),
    aged,
  };

  const cropsChanged =
    upgradedPlan.allocations.map(a => a.result.crop.id).join() !==
    currentPlan.allocations.map(a => a.result.crop.id).join();

  return { machines, gain, cask, upgradedPlan, cropsChanged };
}

export function sprinklerNeeds(tilesUsed) {
  return {
    quality: Math.ceil(tilesUsed / 8),
    iridium: Math.ceil(tilesUsed / 24),
  };
}

function round2(x) { return Math.round(x * 100) / 100; }
