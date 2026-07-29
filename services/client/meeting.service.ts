import { apiFetch } from '@/lib/api';
import { IMeeting } from '@/types';

export interface PaginatedMeetings {
  meetings: IMeeting[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const meetingClientService = {
  getUpcomingMeetings: async (page = 1, limit = 10): Promise<PaginatedMeetings> => {
    return apiFetch<PaginatedMeetings>(`/api/meetings?type=upcoming&page=${page}&limit=${limit}`);
  },

  getMeetingHistory: async (page = 1, limit = 10): Promise<PaginatedMeetings> => {
    return apiFetch<PaginatedMeetings>(`/api/meetings?type=history&page=${page}&limit=${limit}`);
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
      method: 'DELETE', // According to Phase 3, DELETE actually ends the meeting (soft delete)
    });
  }
};
