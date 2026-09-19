#!/usr/bin/env node
/**
 * One-off script to generate the bundled card snapshot at src/data/cards.json.
 * Run: node packages/api/scripts/fetch-cards.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../src/data/cards.json');

const GITHUB_DIR_URL = 'https://api.github.com/repos/hugoprudente/optcgjson/contents/sets/en';
const SET_BASE_URL = 'https://raw.githubusercontent.com/hugoprudente/optcgjson/main/sets/en';

async function fetchSetCodes() {
  const res = await fetch(GITHUB_DIR_URL, {
    headers: { 'User-Agent': 'ai-tcg-coach/fetch-cards' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub directory listing failed: ${res.status}`);
  const files = await res.json();
  return files
    .filter((f) => typeof f.name === 'string' && f.name.endsWith('.json'))
    .map((f) => f.name.slice(0, -5));
}

async function fetchSetCards(setCode) {
  const url = `${SET_BASE_URL}/${setCode}.json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ai-tcg-coach/fetch-cards' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`  [skip] ${setCode}: HTTP ${res.status}`);
      return [];
    }
    const raw = await res.json();
    const cards = raw?.data?.cards;
    if (!Array.isArray(cards)) {
      console.warn(`  [skip] ${setCode}: unexpected format`);
      return [];
    }
    return cards;
  } catch (err) {
    console.warn(`  [skip] ${setCode}: ${err}`);
    return [];
  }
}

function normalizeCard(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry;

  const id =
    typeof e.id === 'string' ? e.id :
    typeof e.number === 'string' ? e.number :
    typeof e.card_id === 'string' ? e.card_id : null;
  const name =
    typeof e.name === 'string' ? e.name :
    typeof e.card_name === 'string' ? e.card_name : null;
  if (!id || !name) return null;

  const type =
    typeof e.class === 'string' ? e.class :
    typeof e.type === 'string' ? e.type :
    typeof e.card_type === 'string' ? e.card_type : null;

  const rawCost = e.cost ?? e.card_cost ?? e.play_cost ?? null;
  const parsedCost = rawCost != null ? parseInt(String(rawCost), 10) : NaN;
  const cost = Number.isNaN(parsedCost) ? null : parsedCost;

  const rawPower = e.power ?? e.card_power ?? null;
  const parsedPower = rawPower != null ? parseInt(String(rawPower), 10) : NaN;
  const power = Number.isNaN(parsedPower) ? null : parsedPower;

  const rawColor = e.color ?? e.colors ?? null;
  let color = null;
  if (Array.isArray(rawColor)) {
    const joined = rawColor.join('/');
    color = joined.length > 0 ? joined : null;
  } else if (typeof rawColor === 'string' && rawColor.length > 0) {
    color = rawColor;
  }

  const rawAttr = e.attribute ?? e.attributes ?? null;
  let attribute = null;
  if (Array.isArray(rawAttr)) {
    const joined = rawAttr.join('/');
    attribute = joined.length > 0 ? joined : null;
  } else if (typeof rawAttr === 'string' && rawAttr.length > 0) {
    attribute = rawAttr;
  }

  const rawEffect = e.effect ?? e.card_effect ?? e.ability ?? e.text ?? e.effects ?? null;
  let effect = null;
  if (Array.isArray(rawEffect)) {
    const joined = rawEffect.join('/');
    effect = joined.length > 0 ? joined : null;
  } else if (typeof rawEffect === 'string' && rawEffect.length > 0) {
    effect = rawEffect;
  }

  const rawImage = e.image_url ?? e.image ?? null;
  const image_url = typeof rawImage === 'string' && rawImage.length > 0 ? rawImage : null;

  return { id, name, type, cost, power, color, attribute, effect, image_url };
}

async function main() {
  console.log('Fetching set list from GitHub...');
  const setCodes = await fetchSetCodes();
  console.log(`Found ${setCodes.length} sets: ${setCodes.slice(0, 5).join(', ')}...`);

  const allCards = new Map();
  let setsProcessed = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < setCodes.length; i += BATCH_SIZE) {
    const batch = setCodes.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  Fetching sets ${i + 1}-${Math.min(i + BATCH_SIZE, setCodes.length)}/${setCodes.length}...`);
    const results = await Promise.all(batch.map(fetchSetCards));
    let batchCount = 0;
    for (const cards of results) {
      for (const card of cards) {
        const normalized = normalizeCard(card);
        if (normalized && !allCards.has(normalized.id)) {
          allCards.set(normalized.id, normalized);
          batchCount++;
        }
      }
    }
    setsProcessed += batch.length;
    process.stdout.write(` +${batchCount} cards\n`);
  }

  const cardArray = Array.from(allCards.values()).sort((a, b) => a.id.localeCompare(b.id));
  console.log(`\nTotal: ${cardArray.length} unique cards from ${setsProcessed} sets`);

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(cardArray, null, 2), 'utf8');
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
