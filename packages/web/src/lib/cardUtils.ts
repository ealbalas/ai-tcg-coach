import type { CardEntry } from './api';

export interface CardWithParallels extends CardEntry {
  parallels: CardEntry[];
}

export function parseCardId(id: string): { set: string; num: string } | null {
  const match = /^([A-Z0-9]+)-([0-9]+)/i.exec(id);
  if (!match) return null;
  return { set: match[1].toUpperCase(), num: match[2] };
}

export function cardImageUrl(image: string | null, id: string): string | null {
  if (!image) return null;
  return `/api/card-image?id=${encodeURIComponent(id)}`;
}

export function groupCardsByBase(cards: CardEntry[]): CardWithParallels[] {
  const map = new Map<string, CardWithParallels>();
  const parallels: CardEntry[] = [];

  for (const card of cards) {
    if (/_[pr]\d+$/.test(card.id)) {
      parallels.push(card);
    } else {
      map.set(card.id, { ...card, parallels: [] });
    }
  }

  for (const parallel of parallels) {
    const baseId = parallel.id.replace(/_[pr]\d+$/, '');
    const base = map.get(baseId);
    if (base) {
      base.parallels.push(parallel);
    } else {
      map.set(parallel.id, { ...parallel, parallels: [] });
    }
  }

  return Array.from(map.values());
}
