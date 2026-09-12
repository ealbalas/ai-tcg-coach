/**
 * Card name lookup module.
 *
 * Fetches community card data at startup and caches it per-set from
 * https://github.com/hugoprudente/optcgjson.
 * Falls back to a hardcoded leader map if all remote fetches fail.
 */

const GITHUB_DIR_URL = 'https://api.github.com/repos/hugoprudente/optcgjson/contents/sets/en';
const SET_BASE_URL = 'https://raw.githubusercontent.com/hugoprudente/optcgjson/main/sets/en';

const FALLBACK_SET_CODES = [
  'OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08',
  'OP09', 'OP10', 'OP11', 'OP12', 'OP13', 'OP14', 'OP15',
  'ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08',
  'ST09', 'ST10', 'ST11', 'ST12', 'ST13', 'ST14', 'ST15', 'ST16',
  'ST17', 'ST18', 'ST19', 'ST20', 'ST21', 'ST22', 'ST23', 'ST24',
  'ST25', 'ST26', 'ST27', 'ST28', 'ST29',
  'EB01', 'EB02', 'EB03', 'EB04',
  'PRB01', 'PRB02',
];

/**
 * @typedef {{ name: string, type: string|null, cost: number|null, power: number|null, color: string|null, effect: string|null, attribute: string|null, image: string|null }} CardRecord
 * @type {Map<string, CardRecord>}
 */
const cardNameCache = new Map();

const FALLBACK_LEADERS = new Map([
  // OP01
  ['OP01-001', 'Monkey D. Luffy'],
  ['OP01-002', 'Roronoa Zoro'],
  ['OP01-003', 'Nami'],
  ['OP01-060', 'Monkey D. Luffy'],
  // OP02
  ['OP02-001', 'Trafalgar Law'],
  ['OP02-049', 'Charlotte Katakuri'],
  ['OP02-093', 'Nami'],
  // OP03
  ['OP03-001', 'Monkey D. Luffy'],
  ['OP03-077', 'Donquixote Doflamingo'],
  // OP04
  ['OP04-001', 'Monkey D. Luffy'],
  ['OP04-020', 'Sanji'],
  ['OP04-040', 'Nico Robin'],
  // OP05
  ['OP05-001', 'Monkey D. Luffy'],
  ['OP05-041', 'Charlotte Katakuri'],
  ['OP05-098', 'Trafalgar Law'],
  // OP06
  ['OP06-001', 'Monkey D. Luffy'],
  ['OP06-022', 'Roronoa Zoro'],
  ['OP06-042', 'Nami'],
  // OP07
  ['OP07-001', 'Monkey D. Luffy'],
  ['OP07-035', 'Rob Lucci'],
  // OP08
  ['OP08-001', 'Monkey D. Luffy'],
  ['OP08-051', 'Blackbeard'],
  // OP09
  ['OP09-001', 'Monkey D. Luffy'],
  // OP10
  ['OP10-001', 'Monkey D. Luffy'],
  // OP16
  ['OP16-001', 'Monkey D. Luffy'],
  ['OP16-022', 'Monkey D. Luffy'],
  // OP17
  ['OP17-001', 'Monkey D. Luffy'],
  ['OP17-094', 'Roronoa Zoro'],
  // ST (starter decks)
  ['ST01-001', 'Monkey D. Luffy'],
  ['ST02-001', 'Roronoa Zoro'],
  ['ST03-001', 'Nami'],
  ['ST04-001', 'Kaido'],
  ['ST05-001', 'Donquixote Doflamingo'],
  ['ST06-001', 'Trafalgar Law'],
  ['ST07-001', 'Charlotte Katakuri'],
  ['ST08-001', 'Monkey D. Luffy'],
  ['ST09-001', 'Yamato'],
  ['ST10-001', 'Monkey D. Luffy'],
  ['ST12-001', 'Zeff'],
  ['ST13-001', 'Monkey D. Luffy'],
]);

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
    typeof e.card_code === 'string' ? e.card_code :
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
 * Fetch the list of available set codes from the GitHub directory listing.
 * Returns null on failure so the caller can fall back to FALLBACK_SET_CODES.
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
 * Fetch and cache the card list at startup.
 * Non-blocking: logs a warning and uses the fallback leader map if all fetches fail.
 */
export async function loadCards() {
  const setCodes = (await fetchSetCodes()) ?? FALLBACK_SET_CODES;
  console.log(`[cards] Loading ${setCodes.length} sets in parallel...`);

  const results = await Promise.allSettled(setCodes.map(fetchSetCards));

  let totalLoaded = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[cards] Set fetch rejected:', result.reason);
      continue;
    }
    const { setCode, cards, error } = result.value;
    if (error) {
      console.warn(`[cards] Failed to load set ${setCode}: ${error}`);
      continue;
    }
    let count = 0;
    for (const entry of cards) {
      const normalized = normalizeEntry(entry);
      if (normalized && !cardNameCache.has(normalized.id)) {
        const { id, ...record } = normalized;
        cardNameCache.set(id, record);
        count++;
      }
    }
    console.log(`[cards] Loaded ${count} cards from set ${setCode}`);
    totalLoaded += count;
  }

  if (totalLoaded === 0) {
    console.warn('[cards] Could not load any card data; using fallback leader map');
    for (const [id, name] of FALLBACK_LEADERS) {
      if (!cardNameCache.has(id)) {
        cardNameCache.set(id, { name, type: 'Leader', cost: null, power: null, color: null, effect: null, attribute: null, image: null });
      }
    }
  } else {
    console.log(`[cards] Total: ${totalLoaded} cards loaded`);
  }
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
