// UI wiring: read the form, run the engine, render results.

import { TIPS, MACHINES, DAYS_PER_SEASON } from './data.js';
import { rankCrops, buildPlan, planFollowUps, sprinklerNeeds, upgradeAdvisor, CELLAR_CAPACITY } from './calc.js';

const $ = id => document.getElementById(id);
const gold = n => `${Math.round(n).toLocaleString()}g`;

function readInputs() {
  return {
    season: $('season').value,
    startDay: clamp(+$('startDay').value || 1, 1, 28),
    budget: Math.max(0, +$('budget').value || 0),
    tiles: Math.max(1, +$('tiles').value || 1),
    farmingLevel: clamp(+$('farmingLevel').value || 0, 0, 10),
    fertilizer: $('fertilizer').value,
    speedGro: $('speedGro').value,
    tiller: $('tiller').checked,
    artisan: $('artisan').checked,
    agriculturist: $('agriculturist').checked,
    goal: $('goal').value,
    targetGold: Math.max(0, +$('targetGold').value || 0),
    location: 'farm',
    sprinklers: {
      basic: Math.max(0, +$('sprBasic').value || 0),
      quality: Math.max(0, +$('sprQuality').value || 0),
      iridium: Math.max(0, +$('sprIridium').value || 0),
    },
    equipment: {
      kegs: Math.max(0, +$('kegs').value || 0),
      jars: Math.max(0, +$('jars').value || 0),
      dehydrators: Math.max(0, +$('dehydrators').value || 0),
      casks: Math.max(0, +$('casks').value || 0),
      greenhouse: $('greenhouse').checked,
      island: $('island').checked,
      desert: $('desert').checked,
    },
  };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

$('goal').addEventListener('change', () => {
  $('targetWrap').classList.toggle('hidden', $('goal').value !== 'target');
});

$('calc').addEventListener('click', () => {
  const ctx = readInputs();
  const ranked = rankCrops(ctx);
  const plan = buildPlan(ranked, ctx);
  const followUps = planFollowUps(plan, ctx);

  renderPlan(plan, ranked, ctx, followUps);
  renderResources(plan, ctx, followUps);
  renderUpgrades(upgradeAdvisor(ctx, plan), ctx);
  renderTable(ranked, ctx);
  renderTips(ctx);
  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------- Recommended plan ----------------
// One-line "what to do with the harvest" for an allocation or wave.
function routeSummary(a, r) {
  if (a.processedItems > 0) {
    let route = a.used.map(u =>
      `turn <strong>${Math.round(u.items).toLocaleString()}</strong> into <strong>${u.r.product}</strong> (${gold(u.r.valuePerItem)}/item vs ${gold(r.rawPerItem)} raw)`
    ).join(', then ');
    if (a.rawItems > 0) route += `, sell the other ${a.rawItems.toLocaleString()} raw <span class="warn">(your machines are maxed — see “What to build next” below)</span>`;
    return route;
  }
  if (r.bestRoute && r.bestRoute.valuePerItem > r.rawPerItem) {
    return `sell raw <span class="warn">(${r.bestRoute.product} would earn ${gold(r.bestRoute.valuePerItem)}/item if you had ${r.bestRoute.route}s — see “What to build next” below)</span>`;
  }
  return 'sell raw';
}

function renderPlan(plan, ranked, ctx, followUps) {
  const el = $('planCard');
  if (!plan.allocations.length) {
    el.innerHTML = `<h2>Recommended plan</h2>
      <p class="warn">Nothing profitable fits this setup — ${
        ctx.season === 'winter' && !ctx.equipment.greenhouse
          ? 'winter has almost no outdoor crops. Check the tips below for what winter is actually for, or unlock the greenhouse.'
          : 'try planting earlier in the season, raising the budget, or unlocking more of the map.'
      }</p>`;
    return;
  }

  const daysLeft = DAYS_PER_SEASON - ctx.startDay + 1;
  const grandTotal = plan.totalProfit + followUps.extraProfit;
  let html = `<h2>Recommended plan — ${cap(ctx.season)}, day ${ctx.startDay} (${daysLeft} days left)</h2>
    <p>Projected season profit: <span class="big-number">${gold(grandTotal)}</span>
    <span class="note">${followUps.extraProfit > 0
      ? `${gold(plan.totalProfit)} first planting + ${gold(followUps.extraProfit)} mid-season replanting · `
      : ''}${plan.tilesUsed} tiles, ${gold(plan.totalSeedCost)} up-front seed cost</span></p>`;

  for (const a of plan.allocations) {
    const r = a.result;
    const c = r.crop;
    html += `<div class="alloc">
      <strong>${c.name}</strong> × ${a.tiles} tiles —
      ${r.harvests} harvest${r.harvests > 1 ? 's' : ''} (${r.growth}-day growth${c.regrow ? `, regrows every ${c.regrow}d` : ', replant each cycle'}),
      ~${a.items.toLocaleString()} items. Best move: ${routeSummary(a, r)}.
      Profit ≈ <strong>${gold(a.profit)}</strong> (${gold(r.goldPerTileDay)}/tile/day)
      ${c.seedNote ? `<div class="note">📌 ${c.seedNote}</div>` : ''}
      ${c.trellis ? `<div class="note">⚠️ Trellis crop — you can't walk through it; leave access rows.</div>` : ''}
      ${r.speedGroWasted ? `<div class="note">💸 Skip the Speed-Gro here — it doesn't add a ${c.name} harvest at this planting day (${r.harvests} either way), so it's pure cost.</div>` : ''}
    </div>`;
  }

  if (followUps.tilesFree > 0) {
    html += `<h3>Mid-season replanting — ${followUps.tilesFree} tiles idle after the first planting</h3>`;
    if (followUps.waves.length) {
      for (const w of followUps.waves) {
        const r = w.result;
        html += `<div class="alloc">
          <strong>Day ${w.day}</strong> — income so far puts ~${gold(w.cashBefore)} in your pocket:
          plant <strong>${r.crop.name}</strong> × ${w.tiles} (${gold(w.seedCost)} seeds) —
          ${r.harvests} harvest${r.harvests > 1 ? 's' : ''}, ~${w.items.toLocaleString()} items.
          Best move: ${routeSummary(w, r)}.
          Extra profit ≈ <strong>${gold(w.profit)}</strong>
          ${r.speedGroWasted ? `<div class="note">💸 Skip the Speed-Gro on this wave — no extra harvest from it at a day-${w.day} planting.</div>` : ''}
        </div>`;
      }
      html += `<p class="note">Income timing: raw sales pay on harvest day, kegs/jars pay when the batch finishes.
        The waves above only use gold your first planting has already earned by that day.</p>`;
    } else {
      html += `<p class="note">Nothing worth a second wave: by the time harvest income lands, no purchasable crop can
        finish before the season ends. Bank the gold for day 1 of next season instead.</p>`;
    }
  }

  if (ctx.goal === 'target' && ctx.targetGold > 0) {
    const best = ranked[0];
    const tilesNeeded = Math.ceil(ctx.targetGold / best.profitPerTile);
    const met = plan.totalProfit >= ctx.targetGold;
    html += `<h3>Gold target: ${gold(ctx.targetGold)}</h3>
      <p>${met
        ? `✅ This plan clears your target with ${gold(plan.totalProfit - ctx.targetGold)} to spare.`
        : `You'd need about <strong>${tilesNeeded} tiles</strong> of ${best.crop.name} (${gold(best.profitPerTile)}/tile) to hit it — this plan reaches ${gold(plan.totalProfit)}. Consider more tiles, more budget, or processing equipment.`}</p>`;
  }
  el.innerHTML = html;
}

// ---------------- Resources required ----------------
function renderResources(plan, ctx, followUps) {
  const el = $('resourceCard');
  if (!plan.allocations.length) { el.innerHTML = ''; return; }

  let html = `<h2>Resources required</h2><h3>Seeds</h3><ul>`;
  for (const a of plan.allocations) {
    html += `<li><strong>${a.result.crop.name}</strong>: ${a.totalSeeds.toLocaleString()} seeds total
      (${a.tiles} up-front for ${gold(a.seedCost)}${a.result.plantings > 1 ? `; replants funded by harvests` : ''})</li>`;
  }
  for (const w of followUps.waves) {
    html += `<li><strong>${w.result.crop.name}</strong> (day ${w.day} replant): ${w.totalSeeds.toLocaleString()} seeds
      for ${gold(w.seedCost)} <span class="note">— funded by harvest income</span></li>`;
  }
  html += `</ul>`;

  // What the machines you OWN are doing in this plan. Building more is
  // the advisor card's job.
  const usage = {}; // machine key -> { batches, products:Set }
  for (const a of [...plan.allocations, ...followUps.waves]) {
    for (const u of a.used || []) {
      const key = u.r.route;
      usage[key] = usage[key] || { batches: 0, products: new Set() };
      usage[key].batches += Math.ceil(u.items / u.r.inputs);
      usage[key].products.add(u.r.product);
    }
  }
  const usageRows = Object.entries(usage).map(([key, u]) => {
    const owned = { keg: ctx.equipment.kegs, jar: ctx.equipment.jars, dehydrator: ctx.equipment.dehydrators }[key];
    return `<li><strong>${MACHINES[key].label}</strong>: your ${owned} run ~${u.batches.toLocaleString()} batches of ${[...u.products].join(' / ')}</li>`;
  });
  if (usageRows.length) {
    html += `<h3>Processing machines</h3><ul>${usageRows.join('')}</ul>
      <p class="note">Want to process more of the harvest? See “What to build next” below.</p>`;
  } else {
    html += `<h3>Processing machines</h3><p class="note">This plan sells everything raw — “What to build next” below shows whether machines would beat that.</p>`;
  }

  const totalTiles = Math.min(ctx.tiles,
    plan.tilesUsed + followUps.waves.reduce((s, w) => s + w.tiles, 0));
  const own = ctx.sprinklers;
  const coverage = own.basic * 4 + own.quality * 8 + own.iridium * 24;
  const ownedBits = [
    own.basic ? `${own.basic} basic` : '',
    own.quality ? `${own.quality} quality` : '',
    own.iridium ? `${own.iridium} iridium` : '',
  ].filter(Boolean).join(' + ');

  html += `<h3>Watering ${totalTiles} tiles</h3>`;
  if (coverage >= totalTiles && coverage > 0) {
    html += `<p>✅ Covered — your sprinklers (${ownedBits}) water up to ${coverage} tiles.</p>`;
  } else {
    const shortTiles = totalTiles - coverage;
    const spr = sprinklerNeeds(shortTiles);
    const q = MACHINES.qualitySprinkler, i = MACHINES.iridiumSprinkler;
    html += `${coverage > 0 ? `<p>Your sprinklers (${ownedBits}) water ${coverage} tiles — for the other ${shortTiles}:</p>` : ''}<ul>
      <li>${spr.quality} Quality Sprinklers (${Object.entries(q.materials).map(([k, v]) => `${v * spr.quality} ${k}`).join(', ')})</li>
      <li>or ${spr.iridium} Iridium Sprinklers (${Object.entries(i.materials).map(([k, v]) => `${v * spr.iridium} ${k}`).join(', ')})</li>
      <li class="note">or the watering can and strong wrists</li></ul>`;
  }

  el.innerHTML = html;
}

// ---------------- Upgrade advisor ----------------
const ROUTE_MACHINE = { keg: 'keg', jar: 'jar', dehydrator: 'dehydrator' };

function materialsFor(machineKey, count) {
  return Object.entries(MACHINES[machineKey].materials)
    .map(([mat, qty]) => `${(qty * count).toLocaleString()} ${mat}`).join(', ');
}

function renderUpgrades(advice, ctx) {
  const el = $('upgradeCard');
  if (!advice) { el.innerHTML = ''; return; }

  const toBuild = advice.machines.filter(m => m.add > 0);
  const totalMaterials = {};
  const addMaterials = (machineKey, count) => {
    for (const [mat, qty] of Object.entries(MACHINES[machineKey].materials)) {
      totalMaterials[mat] = (totalMaterials[mat] || 0) + qty * count;
    }
  };

  let html = `<h2>What to build next <span class="sub">(machines that pay for themselves this season)</span></h2>`;

  if (!toBuild.length && advice.cask.add <= 0) {
    html += `<p>✅ Your current machines already cover the best plan for this setup — nothing new to build.</p>`;
    if (advice.cask.bottles > 0 && advice.cask.owned >= advice.cask.bottles) {
      html += `<p class="note">Your ${advice.cask.owned} casks can absorb all ${advice.cask.bottles.toLocaleString()} ageable bottles too.</p>`;
    }
    el.innerHTML = html;
    return;
  }

  if (toBuild.length) {
    html += `<ul>`;
    for (const m of toBuild) {
      const key = ROUTE_MACHINE[m.route];
      addMaterials(key, m.add);
      html += `<li><strong>${MACHINES[key].label}</strong>: own ${m.owned}, full capture takes ${m.need}
        → build up to <strong>${m.add}</strong> more (${materialsFor(key, m.add)})
        <span class="note">each one adds ≈${gold(m.gainPerMachine)}/season${m.product ? ` making ${m.product}` : ''} · ${MACHINES[key].unlock}</span>
        ${m.add > 40 ? `<div class="note">⚖️ ${m.need} is the “process everything before the season ends” number — harvests don't spoil,
          so fewer machines just clear the backlog over the following weeks instead. Build whatever your materials allow;
          every machine keeps paying ≈${gold(m.gainPerMachine)} per season it runs.</div>` : ''}</li>`;
    }
    html += `</ul>`;
    if (advice.gain > 0) {
      html += `<p>Season profit with these built: <span class="big-number">+${gold(advice.gain)}</span>`;
      if (advice.cropsChanged) {
        const mix = advice.upgradedPlan.allocations.map(a => `${a.result.crop.name} × ${a.tiles}`).join(', ');
        html += ` <span class="warn">— and the best crop mix changes to: ${mix}</span>`;
      }
      html += `</p>`;
    }
  } else {
    html += `<p>✅ Kegs, jars and dehydrators are covered for this plan.</p>`;
  }

  // Casks
  if (advice.cask.bottles > 0) {
    const c = advice.cask;
    html += `<h3>Casks (cellar)</h3>`;
    const breakdown = c.aged.map(b =>
      `${b.bottles.toLocaleString()} ${b.product} (+${gold(b.bottleValue)} each, ${b.agingDays}d to iridium)`).join(' · ');
    if (c.add > 0) {
      addMaterials('cask', c.add);
      html += `<ul><li><strong>${MACHINES.cask.label}</strong>: own ${c.owned}, want ${Math.min(c.bottles, CELLAR_CAPACITY)}
        → build <strong>${c.add}</strong> (${materialsFor('cask', c.add)})
        <span class="note">${MACHINES.cask.unlock} · cellar fits ~${CELLAR_CAPACITY}</span></li></ul>`;
    } else {
      html += `<p>✅ Your ${c.owned} casks cover this season's ageable output.</p>`;
    }
    html += `<p>Aging this season's bottles: ${breakdown}<br>
      Extra gold when they hit iridium: <strong>+${gold(c.gain)}</strong>
      <span class="note">(paid out next season(s) — wine ties up a cask for 56 days, so age your priciest bottles first)</span></p>`;
  }

  if (Object.keys(totalMaterials).length) {
    html += `<p class="note">Total materials shopping list: ${
      Object.entries(totalMaterials).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(' · ')}</p>`;
  }

  el.innerHTML = html;
}

// ---------------- Ranked table ----------------
function renderTable(ranked, ctx) {
  const t = $('rankTable');
  if (!ranked.length) { t.innerHTML = '<tr><td>No crops available.</td></tr>'; return; }
  const rows = ranked.map((r, idx) => {
    const c = r.crop;
    const routeCell = r.bestRoute
      ? `<span class="route">${r.bestRoute.product}</span> ${gold(r.bestRoute.valuePerItem)}`
      : '—';
    return `<tr>
      <td>${idx + 1}</td>
      <td><strong>${c.name}</strong>${c.trellis ? ' 🪜' : ''}${c.where === 'island' ? ' 🏝️' : ''}${c.seedLimited ? ' <span class="note" title="Seeds can’t be bought in bulk — excluded from the auto-plan">🔒</span>' : ''}</td>
      <td class="num">${gold(c.seed)}</td>
      <td class="num">${r.growth}d${c.regrow ? ` +${c.regrow}d` : ''}</td>
      <td class="num">${r.harvests}</td>
      <td class="num ${r.rawProfit < 0 ? 'neg' : ''}">${gold(r.rawProfit)}</td>
      <td>${routeCell}</td>
      <td class="num ${r.processedProfit !== null && r.processedProfit < 0 ? 'neg' : ''}">${r.processedProfit !== null ? gold(r.processedProfit) : '—'}</td>
      <td class="num"><strong>${gold(r.goldPerTileDay)}</strong></td>
    </tr>`;
  }).join('');
  t.innerHTML = `<thead><tr>
    <th>#</th><th>Crop</th><th class="num">Seed</th><th class="num">Growth</th>
    <th class="num">Harvests</th><th class="num">Raw profit/tile</th>
    <th>Best product</th><th class="num">Processed/tile</th><th class="num">g/tile/day</th>
  </tr></thead><tbody>${rows}</tbody>`;
}

// ---------------- Tips ----------------
function renderTips(ctx) {
  const relevant = TIPS.filter(t => { try { return t.when(ctx); } catch { return false; } });
  $('tips').innerHTML = relevant.length
    ? relevant.map(t => `<div class="tip"><h4>${t.title}</h4><p>${t.body}</p></div>`).join('')
    : '<p class="note">No situational tips for this setup.</p>';
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
