const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tcg_token');
}

export function setToken(token: string): void {
  localStorage.setItem('tcg_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('tcg_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (token && typeof window !== 'undefined') window.location.href = '/';
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface GameSummary {
  id: string;
  uploaded_at: string;
  my_leader_card_id: string | null;
  opp_leader_card_id: string | null;
  went_first: boolean | null;
  result: 'win' | 'loss' | 'unknown';
  coaching_status: string;
}

export async function listGames(): Promise<{ games: GameSummary[] }> {
  return request<{ games: GameSummary[] }>('/api/games');
}

export interface CoachingNote {
  id: string;
  game_id: string;
  turn_id: string | null;
  layer: string;
  severity: 'info' | 'warning' | 'critical';
  text: string;
  created_at: string;
}

export interface Action {
  seq: number;
  cardId: string;
  cardName?: string | null;
  cardType?: string | null;
}

export interface Turn {
  id: string;
  game_id: string;
  turn_number: number;
  player: number;
  actions_json: Action[];
  board_state_json: unknown;
}

export interface GameDetail {
  game: {
    id: string;
    uploaded_at: string;
    played_at: string | null;
    my_leader_card_id: string | null;
    opp_leader_card_id: string | null;
    went_first: boolean | null;
    result: 'win' | 'loss' | 'unknown';
    coaching_status: string;
    optcgsim_version: string | null;
    room_id: string | null;
  };
  my_leader_name: string | null;
  opp_leader_name: string | null;
  turns: Turn[];
  coaching_notes: CoachingNote[];
}

export async function getGame(id: string): Promise<GameDetail> {
  return request<GameDetail>(`/api/games/${id}`);
}

export async function uploadGame(file: File): Promise<{ game_id: string; game: GameSummary }> {
  const form = new FormData();
  form.append('log', file);
  return request<{ game_id: string; game: GameSummary }>('/api/games/upload', {
    method: 'POST',
    body: form,
  });
}

export async function getCoachingStatus(id: string): Promise<{ coaching_status: string }> {
  return request<{ coaching_status: string }>(`/api/games/${id}/coaching-status`);
}

export interface CardOnBoard {
  id: string;
  name: string | null;
  active: boolean;
  donAttached: number;
  power?: number | null;
  effect?: string | null;
  type?: string | null;
  cost?: number | null;
}

export interface LeaderOnBoard extends CardOnBoard {
  life: number;
}

export interface HandCard {
  id: string;
  name: string | null;
  power?: number | null;
  effect?: string | null;
  type?: string | null;
  cost?: number | null;
}

export interface PlayerState {
  username: string;
  leader: LeaderOnBoard;
  characters: CardOnBoard[];
  hand: HandCard[];
  handCount: number;
  don: { total: number; active: number; rested: number; attachedToLeader: number; totalAttached: number };
  trash: Array<{ id: string; name: string | null }>;
  life: number;
}

export interface TurnState {
  turn: number;
  activePlayer: 1 | 2;
  actions: string[];
  boardAfter: { player1: PlayerState; player2: PlayerState };
}

export interface ReplayResponse {
  gameId: string | null;
  player1Username: string;
  player2Username: string;
  player1LeaderId: string | null;
  player2LeaderId: string | null;
  winner: string | null;
  turns: TurnState[];
}

export async function getReplay(id: string): Promise<ReplayResponse> {
  return request<ReplayResponse>(`/api/games/${id}/replay`);
}

export interface CardEntry {
  id: string;
  name: string;
  type: string | null;
  cost: number | null;
  power: number | null;
  color: string | null;
  effect: string | null;
  attribute: string | null;
  image: string | null;
}

export async function getCards(): Promise<{ cards: CardEntry[]; total: number }> {
  return request<{ cards: CardEntry[]; total: number }>('/api/cards');
}
