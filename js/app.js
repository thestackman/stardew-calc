// UI wiring: read the form, run the engine, render results.

import { TIPS, MACHINES, DAYS_PER_SEASON } from './data.js';
import { rankCrops, buildPlan, machineNeeds, sprinklerNeeds } from './calc.js';

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

  renderPlan(plan, ranked, ctx);
  renderResources(plan, ctx);
  renderTable(ranked, ctx);
  renderTips(ctx);
  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------- Recommended plan ----------------
function renderPlan(plan, ranked, ctx) {
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
  let html = `<h2>Recommended plan — ${cap(ctx.season)}, day ${ctx.startDay} (${daysLeft} days left)</h2>
    <p>Projected season profit: <span class="big-number">${gold(plan.totalProfit)}</span>
    <span class="note">on ${plan.tilesUsed} tiles, ${gold(plan.totalSeedCost)} up-front seed cost</span></p>`;

  for (const a of plan.allocations) {
    const r = a.result;
    const c = r.crop;
    let route;
    if (a.processedItems > 0) {
      route = `turn <strong>${a.processedItems.toLocaleString()}</strong> into <strong>${r.bestRoute.product}</strong> (${gold(r.bestRoute.valuePerItem)}/item vs ${gold(r.rawPerItem)} raw)`;
      if (a.rawItems > 0) route += `, sell the other ${a.rawItems.toLocaleString()} raw <span class="warn">(machine capacity maxed — see resources below)</span>`;
    } else if (r.bestRoute && r.bestRoute.valuePerItem > r.rawPerItem) {
      route = `sell raw <span class="warn">(${r.bestRoute.product} would earn ${gold(r.bestRoute.valuePerItem)}/item if you had ${r.bestRoute.route}s)</span>`;
    } else {
      route = 'sell raw';
    }
    html += `<div class="alloc">
      <strong>${c.name}</strong> × ${a.tiles} tiles —
      ${r.harvests} harvest${r.harvests > 1 ? 's' : ''} (${r.growth}-day growth${c.regrow ? `, regrows every ${c.regrow}d` : ', replant each cycle'}),
      ~${a.items.toLocaleString()} items. Best move: ${route}.
      Profit ≈ <strong>${gold(a.profit)}</strong> (${gold(r.goldPerTileDay)}/tile/day)
      ${c.seedNote ? `<div class="note">📌 ${c.seedNote}</div>` : ''}
      ${c.trellis ? `<div class="note">⚠️ Trellis crop — you can't walk through it; leave access rows.</div>` : ''}
    </div>`;
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
function renderResources(plan, ctx) {
  const el = $('resourceCard');
  if (!plan.allocations.length) { el.innerHTML = ''; return; }

  const needs = machineNeeds(plan, ctx);
  const spr = sprinklerNeeds(plan.tilesUsed);
  const owned = { keg: ctx.equipment.kegs, jar: ctx.equipment.jars, dehydrator: ctx.equipment.dehydrators };
  const machineKey = { keg: 'keg', jar: 'jar', dehydrator: 'dehydrator' };

  let html = `<h2>Resources required</h2><h3>Seeds</h3><ul>`;
  for (const a of plan.allocations) {
    html += `<li><strong>${a.result.crop.name}</strong>: ${a.totalSeeds.toLocaleString()} seeds total
      (${a.tiles} up-front for ${gold(a.seedCost)}${a.result.plantings > 1 ? `; replants funded by harvests` : ''})</li>`;
  }
  html += `</ul>`;

  const buildRows = [];
  const totalMaterials = {};
  for (const [routeName, count] of Object.entries(needs)) {
    if (count <= 0) continue;
    const short = Math.max(0, count - owned[routeName]);
    const m = MACHINES[machineKey[routeName]];
    buildRows.push(`<li><strong>${m.label}</strong>: need ~${count} for full throughput, you own ${owned[routeName]}`
      + (short > 0
        ? ` → build <strong>${short}</strong> (${Object.entries(m.materials).map(([k, v]) => `${v * short} ${k}`).join(', ')}) <span class="note">[${m.unlock}]</span>`
        : ' ✅')
      + `</li>`);
    if (short > 0) {
      for (const [mat, qty] of Object.entries(m.materials)) {
        totalMaterials[mat] = (totalMaterials[mat] || 0) + qty * short;
      }
    }
  }
  if (buildRows.length) {
    html += `<h3>Processing machines</h3><ul>${buildRows.join('')}</ul>`;
    if (Object.keys(totalMaterials).length) {
      html += `<p class="note">Total materials shopping list: ${
        Object.entries(totalMaterials).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(' · ')}</p>`;
    }
  } else {
    html += `<h3>Processing machines</h3><p class="note">Plan sells raw — no machines required. Add kegs/jars/dehydrators to your setup to see processed comparisons.</p>`;
  }

  const q = MACHINES.qualitySprinkler, i = MACHINES.iridiumSprinkler;
  html += `<h3>Watering ${plan.tilesUsed} tiles</h3><ul>
    <li>${spr.quality} Quality Sprinklers (${Object.entries(q.materials).map(([k, v]) => `${v * spr.quality} ${k}`).join(', ')})</li>
    <li>or ${spr.iridium} Iridium Sprinklers (${Object.entries(i.materials).map(([k, v]) => `${v * spr.iridium} ${k}`).join(', ')})</li>
    <li class="note">or the watering can and strong wrists</li></ul>`;

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
      <td><strong>${c.name}</strong>${c.trellis ? ' 🪜' : ''}${c.where === 'island' ? ' 🏝️' : ''}${c.seedLimited ? ' <span class="note" title="Seeds cannot be bought — excluded from the auto-plan">🔒</span>' : ''}</td>
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
