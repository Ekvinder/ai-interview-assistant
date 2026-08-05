import { useState, useEffect, useRef, useCallback } from 'react';
import { meetingClientService } from '@/services/client/meeting.service';

/**
 * Polls the breakout-room state for the current participant.
 *
 * Design rules:
 * - initialCheckComplete becomes true after the FIRST poll attempt finishes,
 *   regardless of success or failure. The token-fetch in MeetingRoom waits for
 *   this before connecting so it can join the right room on first load.
 * - All returned setters are stable (useCallback / useState setters) so they
 *   never cause unnecessary re-runs of the token-fetch effect in MeetingRoom.
 * - isSwitchingRooms is triggered whenever the assignment changes, including
 *   when newTarget becomes null (return to main meeting).
 */
export function useBreakoutTransition(
  meetingId: string,
  userId: string,
  joinStatus: string,
) {
  const [targetBreakoutId, _setTargetBreakoutId] = useState<string | null>(null);
  const [isSwitchingRooms, setIsSwitchingRooms] = useState(false);
  const [readyForTokenSwitch, setReadyForTokenSwitch] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  // Refs so poll closure never goes stale without re-registering the effect.
  const isSwitchingRef = useRef(false);
  const targetBreakoutIdRef = useRef<string | null>(null);

  /**
   * bypassedBreakoutIdRef — when the host manually removes a participant from a
   * room (newTarget becomes null), we record which room was vacated so the NEXT
   * poll cycle doesn't immediately re-trigger a transition back into it.
   *
   * It is cleared as soon as newTarget moves to a DIFFERENT non-null room so
   * the participant can be re-assigned to the same room later in the session.
   */
  const bypassedBreakoutIdRef = useRef<string | null>(null);

  useEffect(() => { isSwitchingRef.current = isSwitchingRooms; }, [isSwitchingRooms]);
  useEffect(() => { targetBreakoutIdRef.current = targetBreakoutId; }, [targetBreakoutId]);

  // Stable setter exposed to MeetingRoom — never creates a new reference.
  const setTargetBreakoutId = useCallback((id: string | null) => {
    if (id === null && targetBreakoutIdRef.current !== null) {
      // Record the room being vacated.
      bypassedBreakoutIdRef.current = targetBreakoutIdRef.current;
    } else if (id !== null && id !== bypassedBreakoutIdRef.current) {
      // Entering a different room — clear the bypass so the old room can be
      // re-used if the participant is assigned back to it later.
      bypassedBreakoutIdRef.current = null;
    }
    targetBreakoutIdRef.current = id;
    _setTargetBreakoutId(id);
  }, []); // stable — no deps

  // ── Poll ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (joinStatus !== 'approved') return;

    let timerId: ReturnType<typeof setTimeout>;
    let active = true;

    const poll = async () => {
      if (isSwitchingRef.current) {
        // Pause during LiveKit teardown/reconnect to avoid double-transitions.
        if (active) timerId = setTimeout(poll, 3000);
        return;
      }

      try {
        const res = await meetingClientService.getBreakoutRooms(meetingId);
        if (!active) return;

        let newTarget: string | null = null;
        if (res.breakoutRoomsActive && res.breakoutRooms) {
          const myRoom = res.breakoutRooms.find(r =>
            r.participants.some(p => p.toString() === userId),
          );
          if (myRoom) newTarget = myRoom.id;
        }

        // Trigger a room switch whenever the assignment genuinely changes,
        // UNLESS newTarget is the room we just left (bypass guard).
        // Note: newTarget === null (return to main) DOES trigger a switch —
        //       the previous implementation incorrectly skipped this case.
        if (
          newTarget !== targetBreakoutIdRef.current &&
          newTarget !== bypassedBreakoutIdRef.current
        ) {
          // Update the ref first so a rapid second poll won't double-trigger.
          targetBreakoutIdRef.current = newTarget;
          _setTargetBreakoutId(newTarget);
          setIsSwitchingRooms(true);
        }
      } catch (err) {
        // A failed poll (network error, 403 before participant record is written)
        // must never permanently block the connection.
        console.error('[breakout] poll error:', err);
      } finally {
        // Always mark the first check done so MeetingRoom can proceed.
        if (active) setInitialCheckComplete(true);
      }

      if (active) timerId = setTimeout(poll, 3000);
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timerId);
    };
    // setIsSwitchingRooms is a stable useState setter — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinStatus, meetingId, userId]);

  return {
    targetBreakoutId,
    setTargetBreakoutId,    // stable via useCallback
    isSwitchingRooms,
    setIsSwitchingRooms,    // stable — useState setter
    readyForTokenSwitch,
    setReadyForTokenSwitch, // stable — useState setter
    initialCheckComplete,
  };
}
