import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayBoard } from './ReplayBoard';
import type { TurnState, PlayerState } from '@/lib/api';

function makePlayerState(
  username: string,
  leaderId: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    username,
    leader: { id: leaderId, name: null, active: true, donAttached: 0, life: 5 },
    characters: [],
    hand: [],
    handCount: 0,
    don: { total: 10, active: 0, rested: 0, attachedToLeader: 0, totalAttached: 0 },
    trash: [],
    life: 5,
    ...overrides,
  };
}

function makeTurn(overrides: Partial<TurnState> = {}): TurnState {
  return {
    turn: 1,
    activePlayer: 1,
    actions: ['Deployed Nami'],
    boardAfter: {
      player1: makePlayerState('Alice#1234', 'OP01-001'),
      player2: makePlayerState('Bob#5678', 'OP01-002'),
    },
    ...overrides,
  };
}

describe('ReplayBoard', () => {
  it('renders the leader card image for player 1', () => {
    render(
      <ReplayBoard
        turn={makeTurn()}
        currentTurnIndex={0}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const leaderImg = screen.getByTestId('leader-card-bottom');
    expect(leaderImg).toBeTruthy();
  });

  it('renders the leader card image for player 2', () => {
    render(
      <ReplayBoard
        turn={makeTurn()}
        currentTurnIndex={0}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const leaderImg = screen.getByTestId('leader-card-top');
    expect(leaderImg).toBeTruthy();
  });

  it('calls onNext when Next button is clicked', () => {
    const onNext = vi.fn();
    render(
      <ReplayBoard
        turn={makeTurn()}
        currentTurnIndex={0}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next turn'));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onPrev when Prev button is clicked', () => {
    const onPrev = vi.fn();
    render(
      <ReplayBoard
        turn={makeTurn({ turn: 2 })}
        currentTurnIndex={1}
        totalTurns={3}
        onPrev={onPrev}
        onNext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Previous turn'));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('disables Prev button on the first turn', () => {
    render(
      <ReplayBoard
        turn={makeTurn()}
        currentTurnIndex={0}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Previous turn')).toBeDisabled();
  });

  it('disables Next button on the last turn', () => {
    render(
      <ReplayBoard
        turn={makeTurn({ turn: 3 })}
        currentTurnIndex={2}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Next turn')).toBeDisabled();
  });

  it('shows the current turn number', () => {
    render(
      <ReplayBoard
        turn={makeTurn({ turn: 2 })}
        currentTurnIndex={1}
        totalTurns={5}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText('Turn 2 of 5')).toBeTruthy();
  });

  it('displays DON!! badge on a character with donAttached > 0', () => {
    const turn = makeTurn({
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          characters: [{ id: 'OP01-016', name: 'Nami', active: true, donAttached: 2 }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('renders action log entries', () => {
    const turn = makeTurn({ actions: ['Deployed Nami', 'Attacked with Nami'] });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText('Deployed Nami')).toBeTruthy();
    expect(screen.getByText('Attacked with Nami')).toBeTruthy();
  });

  it('shows DON meter with correct pip count based on turn number', () => {
    render(
      <ReplayBoard
        turn={makeTurn({ turn: 4 })}
        currentTurnIndex={3}
        totalTurns={10}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const meter = screen.getByTestId('don-meter');
    expect(meter).toBeTruthy();
    expect(meter.textContent).toContain('4');
  });

  it('DON meter caps at 10 for turns beyond 10', () => {
    render(
      <ReplayBoard
        turn={makeTurn({ turn: 15 })}
        currentTurnIndex={14}
        totalTurns={20}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const meter = screen.getByTestId('don-meter');
    expect(meter.textContent).toContain('10');
  });

  it('DonBadge renders on a character with donAttached > 0', () => {
    const turn = makeTurn({
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          characters: [{ id: 'OP01-016', name: 'Nami', active: true, donAttached: 2 }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('CardEnlargePopup renders with power and effect when hovered', () => {
    const turn = makeTurn({
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          characters: [
            {
              id: 'OP01-016',
              name: 'Nami',
              active: true,
              donAttached: 0,
              power: 2000,
              effect: 'Test effect text',
              type: 'Character',
              cost: 1,
            },
          ],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const charCard = screen.getByTitle('Nami');
    fireEvent.mouseEnter(charCard);
    expect(screen.getByTestId('card-enlarge-popup')).toBeTruthy();
    expect(screen.getByText('Test effect text')).toBeTruthy();
  });

  it('hover on character card shows the popup', () => {
    const turn = makeTurn({
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          characters: [{ id: 'OP01-016', name: 'Nami', active: true, donAttached: 0 }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const charCard = screen.getByTitle('Nami');
    fireEvent.mouseEnter(charCard);
    expect(screen.getByTestId('card-enlarge-popup')).toBeTruthy();
  });

  it('newly drawn hand card has highlight ring class when previousTurn is provided', () => {
    const prevTurn = makeTurn({
      turn: 1,
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', { hand: [] }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    const currentTurn = makeTurn({
      turn: 2,
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          hand: [{ id: 'OP01-020', name: 'Usopp' }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={currentTurn}
        previousTurn={prevTurn}
        currentTurnIndex={1}
        totalTurns={3}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const card = screen.getByTitle('Usopp');
    expect(card.className).toContain('ring-yellow-300');
  });

  it('hand card with counter effect shows CTR badge on the card', () => {
    const turn = makeTurn({
      actions: [],
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          hand: [{ id: 'OP01-050', name: 'Zoro', effect: '[Blocker][On Play] +1000 Counter' }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getAllByText('CTR').length).toBeGreaterThan(0);
  });

  it('hand card without counter effect does not show CTR badge', () => {
    const turn = makeTurn({
      actions: [],
      boardAfter: {
        player1: makePlayerState('Alice#1234', 'OP01-001', {
          hand: [{ id: 'OP01-020', name: 'Usopp', effect: '[Blocker]' }],
        }),
        player2: makePlayerState('Bob#5678', 'OP01-002'),
      },
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.queryByText('CTR')).toBeNull();
  });

  it('counter action entry in action log renders the CTR badge', () => {
    const turn = makeTurn({
      actions: ['Deployed Nami', 'Discarded Usopp for counter'],
    });
    render(
      <ReplayBoard
        turn={turn}
        currentTurnIndex={0}
        totalTurns={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const badges = screen.getAllByText('CTR');
    expect(badges.length).toBeGreaterThan(0);
  });
});
