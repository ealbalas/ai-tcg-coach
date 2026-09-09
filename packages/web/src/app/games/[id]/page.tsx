'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getGame, type GameDetail, type CoachingNote, type Turn } from '@/lib/api';
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
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${severityStyle(note.severity)}`}>
      <span className="font-semibold mr-1">[{severityLabel(note.severity)}]</span>
      {note.text}
    </div>
  );
}

function ActionList({ actions }: { actions: unknown }) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {(actions as Array<{ cardId: string; seq: number }>).map((a) => (
        <span key={a.seq} className="text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded font-mono">
          {a.cardId}
        </span>
      ))}
    </div>
  );
}

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

  const { game, turns, coaching_notes } = detail;

  const notesByTurnId = new Map<string, CoachingNote[]>();
  for (const note of coaching_notes) {
    if (note.turn_id) {
      const list = notesByTurnId.get(note.turn_id) ?? [];
      list.push(note);
      notesByTurnId.set(note.turn_id, list);
    }
  }

  const counts = { info: 0, warning: 0, critical: 0 };
  for (const note of coaching_notes) {
    if (note.severity in counts) counts[note.severity as keyof typeof counts]++;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/games" className="text-gray-400 hover:text-white transition-colors text-sm">
            - Back
          </Link>
          <h1 className="text-xl font-bold text-white">Game Detail</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Game header */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">My Leader</p>
              <p className="font-mono text-sm text-white">{game.my_leader_card_id ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Opponent</p>
              <p className="font-mono text-sm text-white">{game.opp_leader_card_id ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Went First</p>
              <p className="text-sm text-white">
                {game.went_first == null ? 'Unknown' : game.went_first ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Result</p>
              <p className={`text-sm font-semibold ${
                game.result === 'win' ? 'text-green-400' : game.result === 'loss' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {game.result.charAt(0).toUpperCase() + game.result.slice(1)}
              </p>
            </div>
          </div>
          {game.room_id && (
            <p className="text-xs text-gray-600 mt-3">Room ID: {game.room_id} | Version: {game.optcgsim_version}</p>
          )}
        </section>

        {/* Coaching summary */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Coaching Summary</h2>
          {coaching_notes.length === 0 ? (
            <p className="text-gray-500 text-sm">No coaching notes for this game.</p>
          ) : (
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
          )}
        </section>

        {/* Turn timeline */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Turn Timeline</h2>
          {turns.length === 0 ? (
            <p className="text-gray-500 text-sm">No turns recorded.</p>
          ) : (
            <div className="space-y-3">
              {turns.map((turn: Turn) => {
                const turnNotes = notesByTurnId.get(turn.id) ?? [];
                return (
                  <div
                    key={turn.id}
                    className={`bg-gray-900 border rounded-xl p-4 ${
                      turnNotes.length > 0 ? 'border-yellow-800' : 'border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">Turn {turn.turn_number}</span>
                        <span className="text-xs text-gray-500">Player {turn.player}</span>
                      </div>
                      {turnNotes.length > 0 && (
                        <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">
                          {turnNotes.length} note{turnNotes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <ActionList actions={turn.actions_json} />

                    {turnNotes.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {turnNotes.map((note) => (
                          <NoteBadge key={note.id} note={note} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Notes not tied to a specific turn */}
        {coaching_notes.filter((n) => !n.turn_id).length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">General Notes</h2>
            <div className="space-y-2">
              {coaching_notes.filter((n) => !n.turn_id).map((note) => (
                <NoteBadge key={note.id} note={note} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
