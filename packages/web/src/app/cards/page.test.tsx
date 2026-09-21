import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { CardPopup, CardTile } from './components';
import type { CardWithParallels } from '@/lib/cardUtils';

function makeCard(overrides: Partial<CardWithParallels> = {}): CardWithParallels {
  return {
    id: 'OP01-001',
    name: 'Monkey D. Luffy',
    type: 'Leader',
    cost: 5,
    power: 5000,
    color: 'Red',
    effect: '[On Play] Give up to 1 of your characters or your leader 2 DON!! cards.',
    attribute: 'Strike',
    image: 'https://example.com/img.png',
    parallels: [],
    ...overrides,
  };
}

describe('CardPopup', () => {
  it('does not render when hoveredCard is null', () => {
    render(<CardPopup hoveredCard={null} />);
    expect(screen.queryByTestId('card-popup')).toBeNull();
  });

  it('renders with centered fixed positioning', () => {
    const card = makeCard();
    render(<CardPopup hoveredCard={card} />);
    const popup = screen.getByTestId('card-popup');
    expect(popup.style.transform).toBe('translate(-50%, -50%)');
    expect(popup.style.top).toBe('50%');
    expect(popup.style.left).toBe('50%');
  });

  it('renders the full effect text untruncated', () => {
    const longEffect =
      '[On Play] Give up to 1 of your characters or your leader 2 DON!! cards. ' +
      'Then, if your Leader is Red, add up to 1 card from the top of your deck to your hand.';
    const card = makeCard({ effect: longEffect });
    render(<CardPopup hoveredCard={card} />);

    const effectEl = screen.getByTestId('popup-effect');
    expect(effectEl.textContent).toBe(longEffect);
  });

  it('renders the card name', () => {
    const card = makeCard({ name: 'Portgas D. Ace' });
    render(<CardPopup hoveredCard={card} />);
    expect(screen.getByText('Portgas D. Ace')).toBeTruthy();
  });

  it('renders type badge and attribute badge', () => {
    const card = makeCard({ type: 'Character', attribute: 'Slash' });
    render(<CardPopup hoveredCard={card} />);
    expect(screen.getByText('Character')).toBeTruthy();
    expect(screen.getByText('Slash')).toBeTruthy();
  });
});

describe('CardTile hover', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true, configurable: true });
  });

  function HoverWrapper({ card }: { card: CardWithParallels }) {
    const [hovered, setHovered] = useState<CardWithParallels | null>(null);
    return (
      <>
        <CardTile
          card={card}
          onClick={vi.fn()}
          onHover={(c) => setHovered(c)}
          onLeave={() => setHovered(null)}
        />
        {hovered && <div data-testid="hover-indicator">{hovered.name}</div>}
      </>
    );
  }

  it('sets hoveredCard on mouseenter', () => {
    const card = makeCard({ name: 'Test Card' });
    render(<HoverWrapper card={card} />);

    const tile = screen.getByTestId('card-tile');
    fireEvent.mouseEnter(tile);
    expect(screen.getByTestId('hover-indicator').textContent).toBe('Test Card');
  });

  it('clears hoveredCard on mouseleave', () => {
    const card = makeCard({ name: 'Test Card' });
    render(<HoverWrapper card={card} />);

    const tile = screen.getByTestId('card-tile');
    fireEvent.mouseEnter(tile);
    expect(screen.getByTestId('hover-indicator')).toBeTruthy();

    fireEvent.mouseLeave(tile);
    expect(screen.queryByTestId('hover-indicator')).toBeNull();
  });

  it('does not trigger hover on touch devices', () => {
    const card = makeCard({ name: 'Touch Card' });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, writable: true, configurable: true });

    render(<HoverWrapper card={card} />);
    const tile = screen.getByTestId('card-tile');
    fireEvent.mouseEnter(tile);
    expect(screen.queryByTestId('hover-indicator')).toBeNull();
  });
});
