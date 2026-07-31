import { apiFetch } from '@/lib/api';
import { IMeeting } from '@/types';

export interface PaginatedMeetings {
  meetings: IMeeting[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

  joinMeeting: async (meetingId: string): Promise<IMeeting> => {
    return apiFetch<IMeeting>('/api/meetings/join', {
      method: 'POST',
      body: JSON.stringify({ meetingId }),
    });
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
  leaveMeeting: async (meetingId: string): Promise<IMeeting> => {
    return apiFetch<IMeeting>(`/api/meetings/${meetingId}/leave`, {
      method: 'POST',
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
};
