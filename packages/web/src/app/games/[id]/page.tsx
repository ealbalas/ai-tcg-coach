'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getGame, getCoachingStatus, type GameDetail, type CoachingNote, type Turn, type Action } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

function severityStyle(severity: string) {
  if (severity === 'critical') return 'bg-red-950 border-red-700 text-red-300';
  if (severity === 'warning') return 'bg-yellow-950 border-yellow-700 text-yellow-300';
  return 'bg-blue-950 border-blue-800 text-blue-300';
}

function severityLabel(severity: string) {
  if (severity === 'critical') return 'Critical';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}

function NoteBadge({ note }: { note: CoachingNote }) {
  if (note.layer === 'system') {
    return (
      <div className="border rounded-lg px-3 py-2 text-sm bg-slate-900 border-slate-600 text-slate-400">
        <span className="font-semibold mr-1 text-slate-500">&#x2139; System</span>
        {note.text}
      </div>
    );
  }
  if (note.layer === 'llm') {
    return (
      <div className="border rounded-lg px-3 py-2 text-sm bg-violet-950 border-violet-700 text-violet-200">
        <span className="font-semibold mr-1">[AI Coach]</span>
        {note.text}
      </div>
    );
  }
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${severityStyle(note.severity)}`}>
      <span className="font-semibold mr-1">[{severityLabel(note.severity)}]</span>
      {note.text}
    </div>
  );
}

function TurnActions({ actions, isMyTurn }: { actions: Action[]; isMyTurn: boolean }) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return <p className="text-xs text-gray-500 italic mt-1">No actions recorded.</p>;
  }
  return (
    <div className="mt-2 space-y-1">
      {actions.map((a) => (
        <div key={a.seq} className="flex items-start gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${isMyTurn ? 'bg-blue-400' : 'bg-red-400'}`} />
          <span className="text-gray-400 text-xs w-10 flex-shrink-0 mt-0.5">[{a.seq}]</span>
          <div className="flex flex-col min-w-0">
            {a.cardName ? (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {a.cardType && (
                    <span className="text-xs text-purple-400 font-mono">[{a.cardType}]</span>
                  )}
                  <span className="text-gray-100 font-medium">{a.cardName}</span>
                </div>
                <span className="font-mono text-xs text-gray-500">{a.cardId}</span>
              </>
            ) : (
              <span className="font-mono text-xs text-gray-100 bg-gray-700 px-1.5 py-0.5 rounded self-start">{a.cardId}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleNotes({ notes }: { notes: CoachingNote[] }) {
  const [open, setOpen] = useState(false);
  if (notes.length === 0) return null;
  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
      >
        {open ? 'Hide notes' : `Show ${notes.length} coaching note${notes.length !== 1 ? 's' : ''}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {notes.map((note) => (
            <NoteBadge key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderCard({
  label,
  cardId,
  cardName,
  side,
}: {
  label: string;
  cardId: string | null;
  cardName: string | null;
  side: 'my' | 'opp';
}) {
  const borderColor = side === 'my' ? 'border-l-blue-500' : 'border-l-red-500';
  return (
    <div className={`bg-gray-800 border border-gray-700 border-l-4 ${borderColor} rounded-lg p-3`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {cardId ? (
        <>
          <p className="text-sm font-semibold text-white">{cardName ?? cardId}</p>
          {cardName && <p className="font-mono text-xs text-gray-400 mt-0.5">{cardId}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-500">-</p>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deriveMyPlayer(_game: GameDetail['game']): number {
  return 1;
}

const POLLING_STATUSES = new Set(['pending', 'analyzing']);

export default function GameDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/');
      return;
    }
    getGame(id)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  // Poll coaching status while pending/analyzing
  useEffect(() => {
    if (!detail) return;
    const status = detail.game.coaching_status;
    if (!POLLING_STATUSES.has(status)) return;

    const interval = setInterval(async () => {
      try {
        const { coaching_status } = await getCoachingStatus(id);
        if (coaching_status === 'done') {
          const fresh = await getGame(id);
          clearInterval(interval);
          setDetail(fresh);
        } else if (coaching_status === 'error') {
          clearInterval(interval);
          setDetail((prev) =>
            prev ? { ...prev, game: { ...prev.game, coaching_status: 'error' } } : prev,
          );
        }
      } catch {
        // ignore transient poll errors
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, detail?.game.coaching_status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Game not found'}</p>
          <Link href="/games" className="text-blue-400 hover:underline">Back to games</Link>
        </div>
      </div>
    );
  }

  const { game, turns, coaching_notes, my_leader_name, opp_leader_name } = detail;
  const myPlayer = deriveMyPlayer(game);

  const notesByTurnId = new Map<string, CoachingNote[]>();
  for (const note of coaching_notes) {
    if (note.turn_id) {
      const list = notesByTurnId.get(note.turn_id) ?? [];
      list.push(note);
      notesByTurnId.set(note.turn_id, list);
    }
  }
  const globalNotes = coaching_notes.filter((n) => !n.turn_id);

  const counts = { info: 0, warning: 0, critical: 0 };
  for (const note of coaching_notes) {
    if (note.severity in counts) counts[note.severity as keyof typeof counts]++;
  }

  const perTurnNotes = coaching_notes.filter((n) => n.turn_id);
  const turnsWithNotes = turns.filter((t) => (notesByTurnId.get(t.id) ?? []).length > 0).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/games" className="text-gray-400 hover:text-white transition-colors text-sm">
            - Back
          </Link>
          <h1 className="text-xl font-bold text-white">Game Detail</h1>
          <div className="ml-auto">
            <Link
              href={`/games/${id}/replay`}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded transition-colors"
            >
              View Replay
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Game header */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <LeaderCard
              label="My Leader"
              cardId={game.my_leader_card_id}
              cardName={my_leader_name}
              side="my"
            />
            <LeaderCard
              label="Opponent's Leader"
              cardId={game.opp_leader_card_id}
              cardName={opp_leader_name}
              side="opp"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Went First</p>
              <p className="text-white font-medium">
                {game.went_first == null ? 'Unknown' : game.went_first ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Result</p>
              <p className={`font-semibold ${
                game.result === 'win' ? 'text-green-400' :
                game.result === 'loss' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {game.result.charAt(0).toUpperCase() + game.result.slice(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Uploaded</p>
              <p className="text-white">{formatDate(game.uploaded_at)}</p>
            </div>
          </div>

          {game.room_id && (
            <p className="text-xs text-gray-600">Room ID: {game.room_id} | Version: {game.optcgsim_version}</p>
          )}
        </section>

        {/* AI coaching status banner */}
        {POLLING_STATUSES.has(game.coaching_status) && (
          <section className="bg-violet-950 border border-violet-800 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
            <p className="text-violet-200 text-sm">AI coaching is being prepared...</p>
          </section>
        )}
        {game.coaching_status === 'error' && (
          <section className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-3">
            <p className="text-gray-500 text-sm">AI coaching unavailable for this game.</p>
          </section>
        )}

        {/* Coaching summary */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">Coaching Summary</h2>
          {coaching_notes.length === 0 ? (
            <p className="text-green-400 text-sm">No coaching notes - clean game!</p>
          ) : (
            <>
              {perTurnNotes.length > 0 ? (
                <p className="text-gray-400 text-sm mb-3">
                  You have {perTurnNotes.length} coaching note{perTurnNotes.length !== 1 ? 's' : ''} across {turnsWithNotes} turn{turnsWithNotes !== 1 ? 's' : ''}.
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">No per-turn coaching notes.</p>
              )}
              <div className="flex gap-3 flex-wrap">
                {counts.critical > 0 && (
                  <div className="bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
                    <span className="font-bold">{counts.critical}</span> critical
                  </div>
                )}
                {counts.warning > 0 && (
                  <div className="bg-yellow-950 border border-yellow-700 text-yellow-300 rounded-lg px-4 py-2 text-sm">
                    <span className="font-bold">{counts.warning}</span> warning{counts.warning !== 1 ? 's' : ''}
                  </div>
                )}
                {counts.info > 0 && (
                  <div className="bg-blue-950 border border-blue-800 text-blue-300 rounded-lg px-4 py-2 text-sm">
                    <span className="font-bold">{counts.info}</span> info
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* General notes (game-level, not tied to a turn) */}
        {globalNotes.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">General Notes</h2>
            <div className="space-y-2">
              {globalNotes.map((note) => (
                <NoteBadge key={note.id} note={note} />
              ))}
            </div>
          </section>
        )}

        {/* Turn timeline */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Turn Timeline</h2>
          {turns.length === 0 ? (
            <p className="text-gray-500 text-sm">No turns recorded.</p>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

              <div className="space-y-4 pl-10">
                {turns.map((turn: Turn) => {
                  const turnNotes = notesByTurnId.get(turn.id) ?? [];
                  const isMyTurn = turn.player === myPlayer;
                  const borderClass = isMyTurn ? 'border-blue-800' : 'border-gray-700';
                  const dotClass = isMyTurn ? 'bg-blue-500' : 'bg-red-500';
                  const pillClass = isMyTurn
                    ? 'bg-blue-900 text-blue-200'
                    : 'bg-gray-700 text-gray-300';

                  return (
                    <div key={turn.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-gray-900 ${dotClass}`} />

                      <div className={`bg-gray-900 border ${borderClass} rounded-xl p-4`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillClass}`}>
                            Turn {turn.turn_number} - {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
                          </span>
                          {turnNotes.length > 0 && (
                            <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">
                              {turnNotes.length} note{turnNotes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <TurnActions actions={turn.actions_json} isMyTurn={isMyTurn} />

                        <CollapsibleNotes notes={turnNotes} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
