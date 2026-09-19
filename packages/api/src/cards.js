import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(__dirname, 'data/cards.json');

const GITHUB_DIR_URL = 'https://api.github.com/repos/hugoprudente/optcgjson/contents/sets/en';
const SET_BASE_URL = 'https://raw.githubusercontent.com/hugoprudente/optcgjson/main/sets/en';

/**
 * @typedef {{ name: string, type: string|null, cost: number|null, power: number|null, color: string|null, effect: string|null, attribute: string|null, image: string|null }} CardRecord
 * @type {Map<string, CardRecord>}
 */
const cardNameCache = new Map();

/**
 * Try to normalize a card entry from various community JSON formats.
 * Returns a full card record or null.
 * @param {unknown} entry
 * @returns {{ id: string; name: string; type: string|null; cost: number|null; power: number|null; color: string|null; effect: string|null; attribute: string|null; image: string|null } | null}
 */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (entry);

  const id =
    typeof e.id === 'string' ? e.id :
    typeof e.number === 'string' ? e.number :
    typeof e.card_id === 'string' ? e.card_id :
    typeof e.cardId === 'string' ? e.cardId : null;
  const name =
    typeof e.name === 'string' ? e.name :
    typeof e.card_name === 'string' ? e.card_name :
    typeof e.cardName === 'string' ? e.cardName : null;
  if (!id || !name) return null;

  // Prefer e.class (e.g. "LEADER", "CHARACTER") over e.type (short code like "L", "C")
  const type =
    typeof e.class === 'string' ? e.class :
    typeof e.type === 'string' ? e.type :
    typeof e.card_type === 'string' ? e.card_type :
    typeof e.cardType === 'string' ? e.cardType :
    typeof e.category === 'string' ? e.category : null;

  const rawCost = e.cost ?? e.card_cost ?? e.play_cost ?? null;
  const parsedCost = rawCost != null ? parseInt(String(rawCost), 10) : NaN;
  const cost = Number.isNaN(parsedCost) ? null : parsedCost;

  const rawPower = e.power ?? e.card_power ?? null;
  const parsedPower = rawPower != null ? parseInt(String(rawPower), 10) : NaN;
  const power = Number.isNaN(parsedPower) ? null : parsedPower;

  const rawColor = e.color ?? e.colors ?? e.card_color ?? null;
  let color = null;
  if (Array.isArray(rawColor)) {
    const joined = rawColor.join('/');
    color = joined.length > 0 ? joined : null;
  } else if (typeof rawColor === 'string' && rawColor.length > 0) {
    color = rawColor;
  }

  const rawEffect = e.effect ?? e.card_effect ?? e.ability ?? e.text ?? e.card_text ?? e.effects ?? null;
  let effect = null;
  if (Array.isArray(rawEffect)) {
    const joined = rawEffect.join('/');
    effect = joined.length > 0 ? joined : null;
  } else if (typeof rawEffect === 'string' && rawEffect.length > 0) {
    effect = rawEffect;
  }

  const rawAttr = e.attribute ?? e.attributes ?? e.card_attribute ?? null;
  let attribute = null;
  if (Array.isArray(rawAttr)) {
    const joined = rawAttr.join('/');
    attribute = joined.length > 0 ? joined : null;
  } else if (typeof rawAttr === 'string' && rawAttr.length > 0) {
    attribute = rawAttr;
  }

  const rawImage = e.image_url ?? e.image ?? e.img ?? null;
  const image = typeof rawImage === 'string' && rawImage.length > 0 ? rawImage : null;

  return { id, name, type, cost, power, color, effect, attribute, image };
}

/**
 * Load the bundled card snapshot synchronously, populating cardNameCache immediately.
 */
function loadBundle() {
  try {
    const raw = readFileSync(BUNDLE_PATH, 'utf8');
    const cards = JSON.parse(raw);
    let count = 0;
    for (const entry of cards) {
      const normalized = normalizeEntry(entry);
      if (normalized && !cardNameCache.has(normalized.id)) {
        const { id, ...record } = normalized;
        cardNameCache.set(id, record);
        count++;
      }
    }
    console.log(`[cards] Loaded ${count} cards from bundle`);
    return count;
  } catch (err) {
    console.error('[cards] Failed to load bundle:', err);
    return 0;
  }
}

/**
 * Fetch the list of available set codes from the GitHub directory listing.
 * @returns {Promise<string[] | null>}
 */
async function fetchSetCodes() {
  try {
    const res = await fetch(GITHUB_DIR_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const files = await res.json();
    if (!Array.isArray(files)) return null;
    const codes = files
      .filter((f) => typeof f.name === 'string' && f.name.endsWith('.json'))
      .map((f) => f.name.slice(0, -5));
    return codes.length > 0 ? codes : null;
  } catch {
    return null;
  }
}

/**
 * Fetch all cards for a single set code.
 * @param {string} setCode
 * @returns {Promise<{ setCode: string; cards: unknown[]; error?: string }>}
 */
async function fetchSetCards(setCode) {
  const url = `${SET_BASE_URL}/${setCode}.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { setCode, cards: [], error: `HTTP ${res.status}` };
    const raw = await res.json();
    const cards = raw?.data?.cards;
    if (!Array.isArray(cards)) return { setCode, cards: [], error: 'unexpected format' };
    return { setCode, cards };
  } catch (err) {
    return { setCode, cards: [], error: String(err) };
  }
}

/**
 * Background refresh: fetch the latest card data from the remote source.
 * Adds any cards not already in the cache (new sets released after the bundle).
 * Failures are silent - the bundle data remains intact.
 * Exported for testing.
 */
export async function backgroundRefresh() {
  try {
    const setCodes = await fetchSetCodes();
    if (!setCodes) {
      console.log('[cards] Background refresh: could not fetch set list');
      return;
    }
    const results = await Promise.allSettled(setCodes.map(fetchSetCards));
    let newCards = 0;
    for (const result of results) {
      if (result.status === 'rejected') continue;
      const { cards, error } = result.value;
      if (error) continue;
      for (const entry of cards) {
        const normalized = normalizeEntry(entry);
        if (normalized && !cardNameCache.has(normalized.id)) {
          const { id, ...record } = normalized;
          cardNameCache.set(id, record);
          newCards++;
        }
      }
    }
    if (newCards > 0) {
      console.log(`[cards] Background refresh added ${newCards} new cards`);
    } else {
      console.log('[cards] Background refresh: no new cards');
    }
  } catch (err) {
    console.warn('[cards] Background refresh failed:', err);
  }
}

/**
 * Load cards synchronously from the bundled snapshot, then kick off a background
 * refresh to pick up any new sets released after the bundle was committed.
 */
export function loadCards() {
  const bundleCount = loadBundle();
  if (bundleCount === 0) {
    console.warn('[cards] Bundle load returned 0 cards - check data/cards.json');
  }
  // Background refresh - do not await; failures must not affect startup
  backgroundRefresh().catch(() => {});
}

/**
 * Return the card name for a given card ID, or null if unknown.
 * @param {string | null | undefined} cardId
 * @returns {string | null}
 */
export function getCardName(cardId) {
  if (!cardId) return null;
  return cardNameCache.get(cardId)?.name ?? null;
}

/**
 * Return the card type for a given card ID, or null if unknown.
 * @param {string | null | undefined} cardId
 * @returns {string | null}
 */
export function getCardType(cardId) {
  if (!cardId) return null;
  return cardNameCache.get(cardId)?.type ?? null;
}

/**
 * Return the full card record for a given card ID, or null if unknown.
 * @param {string | null | undefined} cardId
 * @returns {CardRecord | null}
 */
export function getCardDetails(cardId) {
  if (!cardId) return null;
  return cardNameCache.get(cardId) ?? null;
}

/**
 * Return all cached cards sorted by id.
 * @returns {Array<CardRecord & { id: string }>}
 */
export function getAllCards() {
  const entries = [];
  for (const [id, record] of cardNameCache) {
    entries.push({ id, ...record });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return entries;
}
