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
  const routes = processingRoutes(crop, ctx);
  let best = null;
  for (const r of routes) {
    if (!best || r.valuePerItem > best.valuePerItem) best = r;
  }
  const machineOwned = { keg: ctx.equipment.kegs, jar: ctx.equipment.jars, dehydrator: ctx.equipment.dehydrators };
  const processedProfit = best ? itemsPerTile * best.valuePerItem - seedCostPerTile : null;
  // Only rank on processed value if the player owns at least one machine
  // of that type AND it beats selling raw.
  const useProcessing = !!(best && machineOwned[best.route] > 0 && best.valuePerItem > rawPerItem);

  const daysUsed = DAYS_PER_SEASON - ctx.startDay + 1;
  const profit = useProcessing ? processedProfit : rawProfit;

  return {
    crop, harvests, plantings, growth,
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

  // Profit if we plant `n` tiles of `r` right now, given what's left
  // of the machine pool (does not mutate the pool).
  const tryAlloc = (r, n) => {
    const items = n * r.itemsPerTile;
    let processedItems = 0;
    if (r.recommendProcessing && r.bestRoute) {
      const perItem = r.bestRoute.machineDays / r.bestRoute.inputs;
      processedItems = Math.min(items, Math.floor(machinePool[r.bestRoute.route] / perItem));
    }
    const profit = (r.recommendProcessing && r.bestRoute)
      ? processedItems * r.bestRoute.valuePerItem + (items - processedItems) * r.rawPerItem - n * r.seedCostPerTile
      : items * r.rawPerItem - n * r.seedCostPerTile;
    return { items, processedItems, profit };
  };

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
    if (r.recommendProcessing && r.bestRoute) {
      machinePool[r.bestRoute.route] -= attempt.processedItems * (r.bestRoute.machineDays / r.bestRoute.inputs);
    }
    const alloc = {
      result: r, tiles: n,
      seedCost: n * r.crop.seed,
      totalSeeds: n * r.plantings,
      profit: Math.round(attempt.profit),
      items: Math.round(attempt.items),
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
  return plan;
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

export function sprinklerNeeds(tilesUsed) {
  return {
    quality: Math.ceil(tilesUsed / 8),
    iridium: Math.ceil(tilesUsed / 24),
  };
}

function round2(x) { return Math.round(x * 100) / 100; }
