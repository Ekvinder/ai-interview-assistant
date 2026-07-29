import { useState, useCallback, useEffect } from 'react';
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

  const fetchMeetings = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (type === 'upcoming') {
        result = await meetingClientService.getUpcomingMeetings(currentPage, limit);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeetings(page);
  }, [page, fetchMeetings]);

  const refresh = () => {
    fetchMeetings(page);
  };

  return {
    data,
    loading,
    error,
    page,
    setPage,
    refresh
  };
}
