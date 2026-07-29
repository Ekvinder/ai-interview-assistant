/**
 * Typed API client for the interview backend.
 * All functions throw on network/auth errors so callers can handle them uniformly.
 */

export interface Interview {
  _id: string;
  userId: string;
  roomName: string;
  role: string;
  interviewType: string;
  difficulty: string;
  experience: string;
  /** Planned duration in minutes — chosen before the interview. */
  duration: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  startedAt?: string;
  endedAt?: string;
  /** Actual duration in minutes — computed from endedAt - startedAt. Only present after completion. */
  actualDuration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalInterviews: number;
  completed: number;
  averageScore: number | null;
  bestScore: number | null;
  recentInterviews: Interview[];
}

export interface CreateInterviewPayload {
  role: string;
  interviewType: string;
  difficulty: string;
  experience: string;
  duration: number;
}

export interface UpdateInterviewPayload {
  status?: 'waiting' | 'active' | 'completed' | 'cancelled';
  startedAt?: string;
  endedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `Request failed with status ${res.status}`);
  }

  return json.data as T;
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export async function createInterview(payload: CreateInterviewPayload): Promise<Interview> {
  return apiFetch<Interview>('/api/interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listInterviews(): Promise<Interview[]> {
  return apiFetch<Interview[]>('/api/interviews');
}

export async function getInterview(id: string): Promise<Interview> {
  return apiFetch<Interview>(`/api/interviews/${id}`);
}

export async function updateInterview(id: string, payload: UpdateInterviewPayload): Promise<Interview> {
  return apiFetch<Interview>(`/api/interviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/api/dashboard');
}

// ─── LiveKit ──────────────────────────────────────────────────────────────────

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

/**
 * Request a LiveKit JWT from the existing token API.
 * @param roomName - The LiveKit room name (stored on the interview as `roomName`)
 * @param identity - Unique identity for this participant (e.g. userId)
 */
export async function getLiveKitToken(
  roomName: string,
  identity: string,
): Promise<LiveKitTokenResponse> {
  const res = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, identity }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `Failed to get LiveKit token (${res.status})`);
  }

  return { token: json.token as string, url: json.url as string };
}
