import { useState, useEffect, useRef, useCallback } from 'react';
import { meetingClientService } from '@/services/client/meeting.service';

/**
 * useBreakoutTransition
 *
 * Polls the backend breakout-room state and drives the participant room-switch
 * lifecycle. Designed to be called once per meeting session; it handles:
 *
 *  • Initial check — on first approved poll, decides which room to join
 *    (main or a specific breakout) before the LiveKit token is fetched.
 *  • Breakout entry — when the host assigns the participant and activates rooms.
 *  • Return to main — when the host closes breakout rooms or removes the
 *    participant from their room.
 *  • Re-entry — participant can be assigned to a new breakout later in the
 *    same meeting without a page refresh.
 *
 * Transition guards
 * ─────────────────
 * isSwitchingRef   — mirrors isSwitchingRooms but is updated synchronously
 *                    so that LiveKit's onDisconnected event (which fires
 *                    synchronously inside room.disconnect()) sees the correct
 *                    value before React has flushed the state update.
 *
 * bypassedBreakoutIdRef — records the last NON-NULL room that was vacated,
 *                         so the next poll cycle doesn't immediately re-trigger
 *                         a transition BACK into the same room. It is:
 *                           • Set when leaving a specific breakout room.
 *                           • Cleared when entering a DIFFERENT non-null room
 *                             (so the old room can be re-used in a later session).
 *                           • NEVER set when returning to main (null), because
 *                             null is not a specific room — every future poll
 *                             should be free to return to main again.
 *
 * All returned setters are stable (useCallback / useState setters) so they
 * never cause unnecessary re-runs of the token-fetch effect in MeetingRoom.
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

  // ── Refs ───────────────────────────────────────────────────────────────────

  /**
   * Mirror of isSwitchingRooms that is always current without waiting for a
   * React re-render. Updated synchronously in MeetingRoom's onBeforeDisconnect
   * callback and via useEffect for other paths.
   */
  const isSwitchingRef = useRef(false);

  /**
   * Mirror of targetBreakoutId — kept in sync via useEffect.
   */
  const targetBreakoutIdRef = useRef<string | null>(null);

  /**
   * The last SPECIFIC (non-null) room that was vacated in this session.
   * Guards against the poll immediately re-triggering entry into the same room
   * after the participant has been removed from it.
   *
   * Rule: only holds a non-null value. Returning to main (null target) must
   * NEVER be stored here — doing so would incorrectly block the return-to-main
   * transition on the next poll cycle.
   */
  const bypassedBreakoutIdRef = useRef<string | null>(null);

  useEffect(() => { isSwitchingRef.current = isSwitchingRooms; }, [isSwitchingRooms]);
  useEffect(() => { targetBreakoutIdRef.current = targetBreakoutId; }, [targetBreakoutId]);

  // ── Stable setter ─────────────────────────────────────────────────────────

  const setTargetBreakoutId = useCallback((id: string | null) => {
    const previous = targetBreakoutIdRef.current;

    if (id === null && previous !== null) {
      // Leaving a specific room → record it so we don't re-enter immediately.
      bypassedBreakoutIdRef.current = previous;
    } else if (id !== null) {
      // Entering a specific room — clear bypass for the OLD room so it can be
      // re-used in a later breakout session within the same meeting.
      if (id !== bypassedBreakoutIdRef.current) {
        bypassedBreakoutIdRef.current = null;
      }
    }
    // Note: id === null does NOT set bypassedBreakoutIdRef.current = null, so
    // the main-room state is never "bypassed".

    targetBreakoutIdRef.current = id;
    _setTargetBreakoutId(id);
  }, []); // stable — no deps

  // ── Poll ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (joinStatus !== 'approved') return;
    // Respect the environment flag that disables automatic polling
    // (used in development / sandboxed environments without a live backend).
    if (process.env.NEXT_PUBLIC_DISABLE_AUTOMATIC_POLLS === 'true') {
      setInitialCheckComplete(true);
      return;
    }

    let timerId: ReturnType<typeof setTimeout>;
    let active = true;

    const poll = async () => {
      // Pause during any active room transition to avoid race conditions.
      if (isSwitchingRef.current) {
        if (active) timerId = setTimeout(poll, 3000);
        return;
      }

      try {
        const res = await meetingClientService.getBreakoutRooms(meetingId);
        if (!active) return;

        // Determine which room (if any) the participant is currently assigned to.
        let newTarget: string | null = null;
        if (res.breakoutRoomsActive && res.breakoutRooms) {
          console.log('[DEBUG BREAKOUT] Polling - userId:', userId, 'breakoutRooms:', res.breakoutRooms);
          const myRoom = res.breakoutRooms.find(r => {
            const found = r.participants.some(p => {
              const pStr = typeof p === 'string' ? p : p.toString();
              console.log('[DEBUG BREAKOUT] Checking participant:', pStr, 'against userId:', userId);
              return pStr === userId;
            });
            console.log('[DEBUG BREAKOUT] Room', r.id, 'has participant?', found);
            return found;
          });
          if (myRoom) {
            console.log('[DEBUG BREAKOUT] Found room for user:', myRoom.id);
            newTarget = myRoom.id;
          } else {
            console.log('[DEBUG BREAKOUT] No room found for user');
          }
        }
        // If breakoutRoomsActive is false OR participant is unassigned:
        // newTarget stays null → return to / stay in main meeting.

        const current = targetBreakoutIdRef.current;

        // Determine whether a room switch is warranted:
        //
        //  Case A — participant is assigned to a new/different breakout room.
        //           Trigger transition unless it is the room we just left.
        //
        //  Case B — breakout was closed or participant was removed from their room
        //           (newTarget === null) AND they are currently in a breakout room
        //           (current !== null). Trigger return-to-main.
        //
        //  Case C — no change. Do nothing.
        //
        // The bypass guard (bypassedBreakoutIdRef) only applies to Case A — it
        // prevents immediate re-entry into the specific room we just vacated.
        // It MUST NOT prevent Case B (return to main), which is why we check
        // newTarget !== null before applying the bypass.

        const isNewBreakoutEntry = newTarget !== null && newTarget !== current;
        const isReturnToMain     = newTarget === null && current !== null;
        const bypassBlocks       = newTarget !== null && newTarget === bypassedBreakoutIdRef.current;

        if ((isNewBreakoutEntry || isReturnToMain) && !bypassBlocks) {
          targetBreakoutIdRef.current = newTarget;
          _setTargetBreakoutId(newTarget);
          setIsSwitchingRooms(true);
        }
      } catch (err) {
        // A failed poll (network error, 403 before record is written) must never
        // permanently block the connection. initialCheckComplete is set below.
        console.error('[breakout] poll error:', err);
      } finally {
        // Always mark the first check done so MeetingRoom proceeds.
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

  // ── Public API ────────────────────────────────────────────────────────────

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
