/**
 * Card name lookup module.
 *
 * Fetches community card data at startup and caches it.
 * Falls back to a hardcoded map of common leaders if both remote URLs fail.
 */

const REMOTE_URLS = [
  'https://raw.githubusercontent.com/rlshuhart/OPTCG-Card-Data/main/card_data.json',
  'https://raw.githubusercontent.com/optcg-community/card-db/main/cards.json',
];

/**
 * @typedef {{ name: string, type: string|null, cost: number|null, power: number|null, color: string|null, effect: string|null, attribute: string|null }} CardRecord
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
 * @returns {{ id: string; name: string; type: string|null; cost: number|null; power: number|null; color: string|null; effect: string|null; attribute: string|null } | null}
 */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (entry);

  const id =
    typeof e.id === 'string' ? e.id :
    typeof e.card_id === 'string' ? e.card_id :
    typeof e.cardId === 'string' ? e.cardId : null;
  const name =
    typeof e.name === 'string' ? e.name :
    typeof e.card_name === 'string' ? e.card_name :
    typeof e.cardName === 'string' ? e.cardName : null;
  if (!id || !name) return null;

  const type =
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
  const effect = typeof rawEffect === 'string' && rawEffect.length > 0 ? rawEffect : null;

  const rawAttr = e.attribute ?? e.attributes ?? e.card_attribute ?? null;
  let attribute = null;
  if (Array.isArray(rawAttr)) {
    const joined = rawAttr.join('/');
    attribute = joined.length > 0 ? joined : null;
  } else if (typeof rawAttr === 'string' && rawAttr.length > 0) {
    attribute = rawAttr;
  }

  return { id, name, type, cost, power, color, effect, attribute };
}

/**
 * Load cards from one URL. Returns number of entries loaded, or 0 on failure.
 * @param {string} url
 * @returns {Promise<number>}
 */
async function tryLoadFromUrl(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return 0;
    const raw = await res.json();
    const entries = Array.isArray(raw) ? raw : Object.values(raw);
    let count = 0;
    for (const entry of entries) {
      const normalized = normalizeEntry(entry);
      if (normalized) {
        const { id, ...record } = normalized;
        cardNameCache.set(id, record);
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Fetch and cache the card list at startup.
 * Non-blocking: logs a warning and uses the fallback map if both URLs fail.
 */
export async function loadCards() {
  for (const url of REMOTE_URLS) {
    const count = await tryLoadFromUrl(url);
    if (count > 0) {
      console.log(`[cards] Loaded ${count} cards from ${url}`);
      return;
    }
  }

  console.warn('[cards] Could not load remote card data; using fallback leader map');
  for (const [id, name] of FALLBACK_LEADERS) {
    cardNameCache.set(id, { name, type: 'Leader', cost: null, power: null, color: null, effect: null, attribute: null });
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
