'use client';

import { useState, useEffect } from 'react';
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

type HoverCardInfo = {
  id: string | null;
  name?: string | null;
  power?: number | null;
  effect?: string | null;
  type?: string | null;
  cost?: number | null;
  donAttached?: number;
  attribute?: string | null;
};

function EmptySlot({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-24 h-36' : 'w-20 h-28';
  return (
    <div
      className={`${sizeClass} rounded border-2 border-dashed border-gray-700 bg-gray-800/20 flex items-center justify-center`}
    >
      <span className="text-gray-700 text-xs">-</span>
    </div>
  );
}

function CardImage({
  id,
  name,
  active,
  donAttached = 0,
  size = 'sm',
  faceDown = false,
  power,
  effect,
  type,
  cost,
  attribute,
  isNew,
  onHover,
  onLeave,
  'data-testid': testId,
}: {
  id: string | null;
  name?: string | null;
  active?: boolean;
  donAttached?: number;
  size?: 'sm' | 'md';
  faceDown?: boolean;
  power?: number | null;
  effect?: string | null;
  type?: string | null;
  cost?: number | null;
  attribute?: string | null;
  isNew?: boolean;
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
  'data-testid'?: string;
}) {
  const url = !faceDown ? cardImageUrl(id) : null;
  const sizeClass = size === 'md' ? 'w-24 h-36' : 'w-20 h-28';
  const restClass = active === false ? 'rotate-90' : '';
  const isCounter = attribute ? /counter/i.test(attribute) : false;

  const handleMouseEnter = () => {
    if (onHover && id) {
      onHover({ id, name, power, effect, type, cost, donAttached, attribute });
    }
  };
  const handleMouseLeave = () => {
    if (onLeave) onLeave();
  };

  return (
    <div
      className={`relative flex-shrink-0 ${sizeClass} rounded overflow-hidden transition-transform duration-150 ${restClass}${isNew ? ' ring-2 ring-offset-1 ring-yellow-300 animate-pulse' : ''}`}
      title={name ?? id ?? ''}
      data-testid={testId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
      {isCounter && (
        <span className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-amber-900/80 text-amber-300 leading-none z-10">
          CTR
        </span>
      )}
    </div>
  );
}

// Card preview panel shown inside the sidebar - no overlay so hover stays stable
function CardPreviewPanel({ card }: { card: HoverCardInfo | null }) {
  if (!card || !card.id) return null;
  const url = cardImageUrl(card.id);
  return (
    <div
      data-testid="card-enlarge-popup"
      className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden p-3 mb-3"
    >
      <div className="flex gap-3">
        <div
          className="rounded-lg overflow-hidden bg-gray-700 flex-shrink-0"
          style={{ width: 64, aspectRatio: '7/10' }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={card.name ?? card.id} className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-white font-bold text-sm leading-tight">{card.name ?? card.id}</p>
          <div className="flex flex-wrap gap-1 text-xs text-gray-400">
            {card.type && (
              <span className="px-1.5 py-0.5 rounded bg-gray-700">{card.type}</span>
            )}
            {card.cost != null && <span>Cost {card.cost}</span>}
            {card.power != null && (
              <span>{Math.round(card.power / 1000)}k pwr</span>
            )}
            {(card.donAttached ?? 0) > 0 && (
              <span className="text-yellow-400">+{card.donAttached} DON!!</span>
            )}
            {card.attribute && (
              <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">{card.attribute}</span>
            )}
          </div>
          {card.effect && (
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-5">
              {card.effect}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// DON pip meter - shows how many DON the active player gets this turn (equals turn number, cap 10)
function DonMeter({ turnNum }: { turnNum: number }) {
  const don = Math.min(turnNum, 10);
  return (
    <div className="flex items-center gap-2" data-testid="don-meter">
      <span className="text-xs text-gray-400">DON</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-sm ${i < don ? 'bg-yellow-400' : 'bg-gray-700'}`}
          />
        ))}
      </div>
      <span className="text-xs font-bold text-yellow-400">{don}</span>
    </div>
  );
}

function LeaderZone({
  leader,
  side,
  onHover,
  onLeave,
}: {
  leader: LeaderOnBoard;
  side: 'top' | 'bottom';
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
}) {
  const borderClass = side === 'bottom' ? 'border-blue-600' : 'border-red-700';
  return (
    <div className="flex flex-col items-center gap-1">
      <CardImage
        id={leader.id}
        name={leader.name}
        active={leader.active}
        donAttached={leader.donAttached}
        power={leader.power}
        effect={leader.effect}
        type={leader.type}
        cost={leader.cost}
        size="md"
        onHover={onHover}
        onLeave={onLeave}
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
      <div className={`w-24 h-36 rounded border-2 ${colorClass} flex items-center justify-center`}>
        <span className="text-2xl font-bold text-white">{count}</span>
      </div>
      <span className="text-xs text-gray-500">life</span>
    </div>
  );
}

function StageZone({
  stage,
  onHover,
  onLeave,
}: {
  stage?: CardOnBoard[];
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
}) {
  const stageCard = stage?.[0];
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Stage</span>
      {stageCard ? (
        <CardImage
          id={stageCard.id}
          name={stageCard.name}
          active={stageCard.active}
          donAttached={stageCard.donAttached}
          power={stageCard.power}
          effect={stageCard.effect}
          type={stageCard.type}
          cost={stageCard.cost}
          attribute={stageCard.attribute}
          onHover={onHover}
          onLeave={onLeave}
        />
      ) : (
        <EmptySlot />
      )}
    </div>
  );
}

// 4 numbered fixed slots; extra slots shown if more than 4 characters are in play
function CharacterRow({
  characters,
  onHover,
  onLeave,
}: {
  characters: CardOnBoard[];
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
}) {
  const slotCount = Math.max(4, characters.length);
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: slotCount }).map((_, i) => {
        const card = characters[i];
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-gray-600">{i + 1}</span>
            {card ? (
              <CardImage
                id={card.id}
                name={card.name}
                active={card.active}
                donAttached={card.donAttached}
                power={card.power}
                effect={card.effect}
                type={card.type}
                cost={card.cost}
                attribute={card.attribute}
                onHover={onHover}
                onLeave={onLeave}
              />
            ) : (
              <EmptySlot />
            )}
          </div>
        );
      })}
    </div>
  );
}

function HandRow({
  hand,
  newCardIds,
  onHover,
  onLeave,
}: {
  hand: PlayerState['hand'];
  newCardIds?: Set<number>;
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
}) {
  if (hand.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-gray-600 text-xs italic">
        No cards in hand
      </div>
    );
  }
  return (
    <div className="flex gap-2 flex-wrap items-end min-h-[7rem]">
      {hand.map((h, i) => (
        <CardImage
          key={`${h.id}-${i}`}
          id={h.id}
          name={h.name}
          active
          power={h.power}
          effect={h.effect}
          type={h.type}
          cost={h.cost}
          attribute={h.attribute}
          isNew={newCardIds?.has(i)}
          onHover={onHover}
          onLeave={onLeave}
        />
      ))}
    </div>
  );
}

function PlayerHalf({
  state,
  side,
  newCardIds,
  onHover,
  onLeave,
}: {
  state: PlayerState;
  side: 'top' | 'bottom';
  newCardIds?: Set<number>;
  onHover?: (card: HoverCardInfo) => void;
  onLeave?: () => void;
}) {
  const isBottom = side === 'bottom';
  const labelClass = isBottom ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`flex flex-col gap-3 py-3 px-4 ${isBottom ? '' : 'flex-col-reverse'}`}>
      {/* Hand - all cards revealed */}
      <div>
        <span className={`text-xs font-semibold ${labelClass} mb-1 block`}>
          {state.username} - Hand ({state.hand.length})
        </span>
        <HandRow hand={state.hand} newCardIds={newCardIds} onHover={onHover} onLeave={onLeave} />
      </div>

      {/* Stage + Character zone */}
      <div>
        <span className="text-xs text-gray-500 mb-2 block">Field</span>
        <div className="flex gap-4 items-start">
          <StageZone stage={state.stage} onHover={onHover} onLeave={onLeave} />
          <CharacterRow characters={state.characters} onHover={onHover} onLeave={onLeave} />
        </div>
      </div>

      {/* Leader + Life */}
      <div className="flex items-center gap-6">
        <LeaderZone leader={state.leader} side={side} onHover={onHover} onLeave={onLeave} />
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
  previousTurn?: TurnState | null;
  currentTurnIndex: number;
  totalTurns: number;
  onPrev: () => void;
  onNext: () => void;
}

function computeNewCardIds(
  currentHand: PlayerState['hand'],
  previousHand: PlayerState['hand'],
): Set<number> {
  const prevCounts = new Map<string, number>();
  for (const c of previousHand) {
    prevCounts.set(c.id, (prevCounts.get(c.id) ?? 0) + 1);
  }
  const seenCounts = new Map<string, number>();
  const newIndices = new Set<number>();
  for (let i = 0; i < currentHand.length; i++) {
    const id = currentHand[i].id;
    const seen = (seenCounts.get(id) ?? 0) + 1;
    seenCounts.set(id, seen);
    if (seen > (prevCounts.get(id) ?? 0)) {
      newIndices.add(i);
    }
  }
  return newIndices;
}

export function ReplayBoard({
  turn,
  previousTurn,
  currentTurnIndex,
  totalTurns,
  onPrev,
  onNext,
}: ReplayBoardProps) {
  const { boardAfter, actions, activePlayer } = turn;
  const [hoveredCard, setHoveredCard] = useState<HoverCardInfo | null>(null);
  // -1 = no action highlighted (turn overview); 0..N-1 = step through each action
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);

  // Reset action step whenever the turn changes
  useEffect(() => {
    setCurrentActionIndex(-1);
  }, [currentTurnIndex]);

  const handlePrevAction = () =>
    setCurrentActionIndex((i) => Math.max(-1, i - 1));

  const handleNextAction = () =>
    setCurrentActionIndex((i) => Math.min(actions.length - 1, i + 1));

  const newP1CardIds = previousTurn
    ? computeNewCardIds(boardAfter.player1.hand, previousTurn.boardAfter.player1.hand)
    : new Set<number>();
  const newP2CardIds = previousTurn
    ? computeNewCardIds(boardAfter.player2.hand, previousTurn.boardAfter.player2.hand)
    : new Set<number>();

  return (
    <div className="flex flex-col gap-4">
      {/* Turn nav with DON meter */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <button
          onClick={onPrev}
          disabled={currentTurnIndex === 0}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
          aria-label="Previous turn"
        >
          Prev
        </button>
        <div className="flex flex-col items-center gap-1">
          <p className="text-white font-semibold">
            Turn {turn.turn} of {totalTurns}
          </p>
          <p className="text-xs text-gray-400">Player {activePlayer}&apos;s turn</p>
          <DonMeter turnNum={turn.turn} />
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
            <PlayerHalf
              state={boardAfter.player2}
              side="top"
              newCardIds={newP2CardIds}
              onHover={setHoveredCard}
              onLeave={() => setHoveredCard(null)}
            />
          </div>
          <div className="bg-gray-800 h-px" />
          {/* You (player 1) at bottom */}
          <PlayerHalf
            state={boardAfter.player1}
            side="bottom"
            newCardIds={newP1CardIds}
            onHover={setHoveredCard}
            onLeave={() => setHoveredCard(null)}
          />
        </div>

        {/* Right sidebar: card preview + play-by-play */}
        <div className="w-72 flex-shrink-0 flex flex-col">
          {/* Card preview - inline in sidebar, no overlay so hover stays stable */}
          {hoveredCard ? (
            <CardPreviewPanel card={hoveredCard} />
          ) : (
            <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-3 flex items-center justify-center text-xs text-gray-600 italic mb-3" style={{ minHeight: 80 }}>
              Hover a card to preview
            </div>
          )}

          {/* Play-by-play action log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Play by Play
              </h3>
              {actions.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevAction}
                    disabled={currentActionIndex <= -1}
                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    aria-label="Previous action"
                  >
                    &lt;
                  </button>
                  <span className="text-xs text-gray-500 tabular-nums w-10 text-center">
                    {currentActionIndex === -1 ? `0/${actions.length}` : `${currentActionIndex + 1}/${actions.length}`}
                  </span>
                  <button
                    onClick={handleNextAction}
                    disabled={currentActionIndex >= actions.length - 1}
                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    aria-label="Next action"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>

            {currentActionIndex >= 0 && actions[currentActionIndex] && (() => {
              const action = actions[currentActionIndex];
              const isCounter = action.toLowerCase().includes('for counter');
              return (
                <div className={`mb-2 px-2 py-1.5 rounded-lg ${isCounter ? 'bg-amber-900/40 border border-amber-800/60' : 'bg-blue-900/40 border border-blue-800/60'}`}>
                  <p className={`text-xs leading-snug flex items-center gap-1 ${isCounter ? 'text-amber-200' : 'text-blue-200'}`}>
                    {isCounter && (
                      <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-amber-900/60 text-amber-300">CTR</span>
                    )}
                    {action}
                  </p>
                </div>
              );
            })()}

            {actions.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No actions recorded.</p>
            ) : (
              <ul className="space-y-0.5 overflow-y-auto max-h-80">
                {actions.map((a, i) => {
                  const isCounter = a.toLowerCase().includes('for counter');
                  return (
                    <li
                      key={i}
                      className={`text-xs flex gap-1.5 px-2 py-1 rounded transition-colors ${
                        i === currentActionIndex
                          ? isCounter
                            ? 'bg-amber-900/50 text-amber-200'
                            : 'bg-blue-900/50 text-white'
                          : i < currentActionIndex
                          ? 'text-gray-600'
                          : isCounter
                          ? 'text-amber-300'
                          : 'text-gray-400'
                      }`}
                    >
                      <span className="flex-shrink-0 text-gray-600">{i + 1}.</span>
                      {isCounter && (
                        <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-amber-900/60 text-amber-300">CTR</span>
                      )}
                      <span>{a}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
