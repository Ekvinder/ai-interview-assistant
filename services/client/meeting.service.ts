import { apiFetch } from '@/lib/api';
import { IMeeting, IBreakoutRoom } from '@/types';

export interface PaginatedMeetings {
  meetings: IMeeting[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'denied';
export interface PendingJoinRequest { userId: string; name: string; requestedAt: string; }

interface PaginatedEnvelope {
  success: boolean;
  message: string;
  data: IMeeting[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchPaginated(url: string): Promise<PaginatedMeetings> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  const json: PaginatedEnvelope = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `Request failed with status ${res.status}`);
  }
  return {
    meetings: json.data,
    page: json.pagination.page,
    limit: json.pagination.limit,
    total: json.pagination.total,
    totalPages: json.pagination.totalPages,
  };
}

export const meetingClientService = {
  getUpcomingMeetings: async (page = 1, limit = 10): Promise<PaginatedMeetings> => {
    return fetchPaginated(`/api/meetings?type=upcoming&page=${page}&limit=${limit}`);
  },

  getMeetingHistory: async (page = 1, limit = 10): Promise<PaginatedMeetings> => {
    return fetchPaginated(`/api/meetings?type=history&page=${page}&limit=${limit}`);
  },

  createMeeting: async (payload: Record<string, unknown>): Promise<IMeeting> => {
    return apiFetch<IMeeting>('/api/meetings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  joinMeeting: async (meetingId: string, guestId?: string, guestName?: string): Promise<{ status: JoinRequestStatus }> => {
    return apiFetch<{ status: JoinRequestStatus }>('/api/meetings/join', {
      method: 'POST',
      body: JSON.stringify({ meetingId, guestId, guestName }),
    });
  },

  getJoinRequestStatus: async (meetingId: string, guestId?: string): Promise<JoinRequestStatus> => {
    const url = guestId ? `/api/meetings/${meetingId}/join-requests?guestId=${encodeURIComponent(guestId)}` : `/api/meetings/${meetingId}/join-requests`;
    const result = await apiFetch<{ status: JoinRequestStatus }>(url);
    return result.status;
  },

  getPendingJoinRequests: async (meetingId: string): Promise<PendingJoinRequest[]> => {
    return apiFetch<PendingJoinRequest[]>(`/api/meetings/${meetingId}/join-requests`);
  },

  decideJoinRequest: async (meetingId: string, userId: string, approved: boolean): Promise<JoinRequestStatus> => {
    const result = await apiFetch<{ status: JoinRequestStatus }>(`/api/meetings/${meetingId}/join-requests`, {
      method: 'POST', body: JSON.stringify({ userId, approved }),
    });
    return result.status;
  },

  updateMeeting: async (id: string, payload: Record<string, unknown>): Promise<IMeeting> => {
    return apiFetch<IMeeting>(`/api/meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteMeeting: async (id: string): Promise<IMeeting> => {
    return apiFetch<IMeeting>(`/api/meetings/${id}`, {
      method: 'DELETE',
    });
  },

  endMeeting: async (id: string): Promise<IMeeting> => {
    return apiFetch<IMeeting>(`/api/meetings/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Record that the current user has left the meeting (does not end it for everyone).
   * Uses the public meetingId string (not the internal _id).
   */
  leaveMeeting: async (meetingId: string, guestId?: string): Promise<IMeeting> => {
    return apiFetch<IMeeting>(`/api/meetings/${meetingId}/leave`, {
      method: 'POST',
      body: guestId ? JSON.stringify({ guestId }) : undefined,
    });
  },

  /**
   * Host only — remove a participant from the LiveKit room.
   * meetingId = public meetingId string; participantIdentity = LiveKit identity (userId).
   */
  removeParticipant: async (meetingId: string, participantIdentity: string): Promise<void> => {
    await apiFetch<null>(`/api/meetings/${meetingId}/remove-participant`, {
      method: 'POST',
      body: JSON.stringify({ participantIdentity }),
    });
  },

  /**
   * Persist the whiteboard canvas as a PNG data URL.
   * meetingId = public meetingId string.
   */
  saveWhiteboard: async (meetingId: string, dataUrl: string): Promise<void> => {
    await apiFetch<{ saved: boolean }>(`/api/meetings/${meetingId}/whiteboard`, {
      method: 'PUT',
      body: JSON.stringify({ dataUrl }),
    });
  },

  /**
   * Load the previously saved whiteboard data URL for a meeting.
   * Returns an empty string if the whiteboard has never been saved.
   */
  loadWhiteboard: async (meetingId: string): Promise<string> => {
    const result = await apiFetch<{ whiteboardData: string }>(`/api/meetings/${meetingId}/whiteboard`);
    return result.whiteboardData ?? '';
  },

  /**
   * Breakout Rooms - Phase 1 Backend Preparation
   */
  getBreakoutRooms: async (meetingId: string): Promise<{ breakoutRooms: IBreakoutRoom[], breakoutRoomsActive: boolean }> => {
    return apiFetch<{ breakoutRooms: IBreakoutRoom[], breakoutRoomsActive: boolean }>(`/api/meetings/${meetingId}/breakout`);
  },

  createBreakoutRooms: async (meetingId: string, rooms: { id: string, name: string }[]): Promise<IBreakoutRoom[]> => {
    return apiFetch<IBreakoutRoom[]>(`/api/meetings/${meetingId}/breakout`, {
      method: 'POST',
      body: JSON.stringify({ rooms }),
    });
  },

  updateBreakoutRoomsStatus: async (meetingId: string, isActive: boolean): Promise<{ active: boolean }> => {
    return apiFetch<{ active: boolean }>(`/api/meetings/${meetingId}/breakout/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  assignToBreakoutRoom: async (meetingId: string, breakoutRoomId: string, participantId: string): Promise<IBreakoutRoom[]> => {
    return apiFetch<IBreakoutRoom[]>(`/api/meetings/${meetingId}/breakout/assign`, {
      method: 'POST',
      body: JSON.stringify({ breakoutRoomId, participantId }),
    });
  },
};
