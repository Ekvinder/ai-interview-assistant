import { useState, useCallback, useEffect, useRef } from 'react';
import { meetingClientService, PaginatedMeetings } from '@/services/client/meeting.service';

interface UseMeetingsProps {
  type: 'upcoming' | 'history';
  initialPage?: number;
  limit?: number;
}

export function useMeetings({ type, initialPage = 1, limit = 10 }: UseMeetingsProps) {
  const [data, setData] = useState<PaginatedMeetings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);

  // Keep a ref so refresh() always reads the current page without going stale
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  const fetchMeetings = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (type === 'upcoming') {
        result = await meetingClientService.getUpcomingMeetings(currentPage, limit);
        // Ensure newest upcoming meetings appear first
        if (result && Array.isArray(result.meetings)) {
          result.meetings.sort((a, b) => {
            const dateA = new Date(a.scheduledFor || a.createdAt);
            const dateB = new Date(b.scheduledFor || b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
        }
      } else {
        result = await meetingClientService.getMeetingHistory(currentPage, limit);
      }
      setData(result);
    } catch (err) {
      const e = err as Error;
      setError(e.message || 'Failed to fetch meetings');
    } finally {
      setLoading(false);
    }
  }, [type, limit]);

  useEffect(() => {
    const load = async () => {
      await fetchMeetings(page);
    };
    void load();
  }, [page, fetchMeetings]);

  const refresh = useCallback(() => {
    fetchMeetings(pageRef.current);
  }, [fetchMeetings]);

  return {
    data,
    loading,
    error,
    page,
    setPage,
    refresh,
  };
}
