#!/usr/bin/env node
/**
 * One-off script to generate the bundled card snapshot at src/data/cards.json.
 * Run: node packages/api/scripts/fetch-cards.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEntry } from '../src/cards.js';

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
        const normalized = normalizeEntry(card);
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
