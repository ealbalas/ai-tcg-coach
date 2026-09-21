'use client';

import type { PlayerState, CardOnBoard, LeaderOnBoard, TurnState } from '@/lib/api';

const CARD_BACK_BG = 'bg-gray-700 border border-gray-600';

function cardImageUrl(id: string | null) {
  if (!id) return null;
  return `/api/card-image?id=${encodeURIComponent(id)}`;
}

function DonBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-10 leading-none">
      +{count}
    </span>
  );
}

function CardImage({
  id,
  name,
  active,
  donAttached = 0,
  size = 'sm',
  faceDown = false,
  'data-testid': testId,
}: {
  id: string | null;
  name?: string | null;
  active?: boolean;
  donAttached?: number;
  size?: 'sm' | 'md';
  faceDown?: boolean;
  'data-testid'?: string;
}) {
  const url = !faceDown ? cardImageUrl(id) : null;
  const sizeClass = size === 'md' ? 'w-20 h-28' : 'w-14 h-20';
  const restClass = active === false ? 'rotate-90' : '';

  return (
    <div
      className={`relative flex-shrink-0 ${sizeClass} rounded overflow-hidden transition-transform duration-150 ${restClass}`}
      title={name ?? id ?? ''}
      data-testid={testId}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ?? id ?? ''} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full ${CARD_BACK_BG} flex items-center justify-center`}>
          <span className="text-gray-500 text-xs font-mono text-center px-1 break-all leading-tight">
            {faceDown ? '?' : (id ?? '?')}
          </span>
        </div>
      )}
      <DonBadge count={donAttached} />
    </div>
  );
}

function LeaderZone({ leader, side }: { leader: LeaderOnBoard; side: 'top' | 'bottom' }) {
  const borderClass = side === 'bottom' ? 'border-blue-600' : 'border-red-700';
  return (
    <div className="flex flex-col items-center gap-1">
      <CardImage
        id={leader.id}
        name={leader.name}
        active={leader.active}
        donAttached={leader.donAttached}
        size="md"
        data-testid={`leader-card-${side}`}
      />
      <div className={`text-xs px-2 py-0.5 rounded-full border ${borderClass} text-white font-bold`}>
        {leader.life} life
      </div>
    </div>
  );
}

function LifeStack({ count, side }: { count: number; side: 'top' | 'bottom' }) {
  const colorClass = side === 'bottom' ? 'border-blue-700 bg-blue-950' : 'border-red-800 bg-red-950';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-14 h-20 rounded border-2 ${colorClass} flex items-center justify-center`}>
        <span className="text-2xl font-bold text-white">{count}</span>
      </div>
      <span className="text-xs text-gray-500">life</span>
    </div>
  );
}

function CharacterRow({ characters }: { characters: CardOnBoard[] }) {
  if (characters.length === 0) {
    return <div className="h-20 flex items-center justify-center text-gray-600 text-xs italic">No characters</div>;
  }
  return (
    <div className="flex gap-2 flex-wrap min-h-[5rem]">
      {characters.map((c, i) => (
        <CardImage key={`${c.id}-${i}`} id={c.id} name={c.name} active={c.active} donAttached={c.donAttached} />
      ))}
    </div>
  );
}

function DonRow({ don }: { don: PlayerState['don'] }) {
  const donCards = Array.from({ length: Math.max(0, don.active) });
  const restedCards = Array.from({ length: Math.max(0, don.rested) });
  return (
    <div className="flex gap-1 flex-wrap min-h-[1.25rem] items-center">
      <span className="text-xs text-gray-500 mr-1">DON!!:</span>
      {don.active === 0 && don.rested === 0 ? (
        <span className="text-xs text-gray-600 italic">none available</span>
      ) : (
        <>
          {donCards.map((_, i) => (
            <div key={`a${i}`} className="w-5 h-7 rounded bg-yellow-500 border border-yellow-400" />
          ))}
          {restedCards.map((_, i) => (
            <div key={`r${i}`} className="w-7 h-5 rounded bg-yellow-700 border border-yellow-600 rotate-90" />
          ))}
        </>
      )}
      {don.attachedToLeader > 0 && (
        <span className="text-xs text-yellow-400 ml-1">(+{don.attachedToLeader} on leader)</span>
      )}
    </div>
  );
}

function HandRow({ hand, handCount }: { hand: PlayerState['hand']; handCount: number }) {
  const unknownCount = Math.max(0, handCount - hand.length);

  return (
    <div className="flex gap-2 flex-wrap items-end min-h-[5rem]">
      {hand.map((h, i) => (
        <CardImage key={`${h.id}-${i}`} id={h.id} name={h.name} active />
      ))}
      {Array.from({ length: unknownCount }).map((_, i) => (
        <CardImage key={`unk-${i}`} id={null} faceDown active />
      ))}
    </div>
  );
}

function PlayerHalf({
  state,
  side,
}: {
  state: PlayerState;
  side: 'top' | 'bottom';
}) {
  const isBottom = side === 'bottom';
  const labelClass = isBottom ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`flex flex-col gap-3 py-3 px-4 ${isBottom ? '' : 'flex-col-reverse'}`}>
      {/* Hand */}
      <div>
        <span className={`text-xs font-semibold ${labelClass} mb-1 block`}>
          {state.username} - Hand ({state.handCount})
        </span>
        <HandRow hand={state.hand} handCount={state.handCount} />
      </div>

      {/* DON!! */}
      <DonRow don={state.don} />

      {/* Characters */}
      <div>
        <span className="text-xs text-gray-500 mb-1 block">Characters</span>
        <CharacterRow characters={state.characters} />
      </div>

      {/* Leader + Life */}
      <div className="flex items-center gap-6">
        <LeaderZone leader={state.leader} side={side} />
        <LifeStack count={state.life} side={side} />
        <div className="flex flex-col">
          <span className={`text-sm font-bold ${labelClass}`}>{state.username}</span>
          <span className="text-xs text-gray-500">
            {isBottom ? 'You (Player 1)' : 'Opponent (Player 2)'}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface ReplayBoardProps {
  turn: TurnState;
  currentTurnIndex: number;
  totalTurns: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ReplayBoard({
  turn,
  currentTurnIndex,
  totalTurns,
  onPrev,
  onNext,
}: ReplayBoardProps) {
  const { boardAfter, actions, activePlayer } = turn;

  return (
    <div className="flex flex-col gap-4">
      {/* Turn nav */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <button
          onClick={onPrev}
          disabled={currentTurnIndex === 0}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
          aria-label="Previous turn"
        >
          Prev
        </button>
        <div className="text-center">
          <p className="text-white font-semibold">
            Turn {turn.turn} of {totalTurns}
          </p>
          <p className="text-xs text-gray-400">
            Active: Player {activePlayer}
          </p>
        </div>
        <button
          onClick={onNext}
          disabled={currentTurnIndex >= totalTurns - 1}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
          aria-label="Next turn"
        >
          Next
        </button>
      </div>

      <div className="flex gap-4">
        {/* Board */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Opponent (player 2) at top */}
          <div className="border-b border-gray-700">
            <PlayerHalf state={boardAfter.player2} side="top" />
          </div>
          {/* Center divider */}
          <div className="bg-gray-800 h-px" />
          {/* You (player 1) at bottom */}
          <PlayerHalf state={boardAfter.player1} side="bottom" />
        </div>

        {/* Action log sidebar */}
        <div className="w-64 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Turn {turn.turn} Actions
          </h3>
          {actions.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No actions recorded.</p>
          ) : (
            <ul className="space-y-1 overflow-y-auto max-h-96">
              {actions.map((a, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                  <span className="text-gray-600 flex-shrink-0">{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
