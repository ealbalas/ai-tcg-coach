import type { CardEntry } from './api';

export function filterCards(
  cards: CardEntry[],
  query: string,
  selectedType: string,
  selectedColor: string,
): CardEntry[] {
  let result = cards;

  if (query) {
    const lower = query.toLowerCase();
    result = result.filter((c) => c.name.toLowerCase().includes(lower));
  }

  if (selectedType !== 'All') {
    const typeLower = selectedType.toLowerCase();
    result = result.filter((c) => c.type != null && c.type.toLowerCase() === typeLower);
  }

  if (selectedColor !== 'All Colors') {
    const colorLower = selectedColor.toLowerCase();
    result = result.filter(
      (c) => c.color != null && c.color.toLowerCase().includes(colorLower),
    );
  }

  return result;
}
