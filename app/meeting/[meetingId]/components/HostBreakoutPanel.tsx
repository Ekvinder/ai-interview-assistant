import BreakoutRoomsPanel, { type BreakoutRoomsPanelProps } from './BreakoutRoomsPanel';

/**
 * HostBreakoutPanel – a thin wrapper around the existing BreakoutRoomsPanel.
 * It simply forwards all props, preserving the full breakout‑room management UI
 * while keeping the host‑only rendering logic inside `MeetingRoom.tsx`.
 *
 * This approach avoids duplicating any business logic or UI code and satisfies
 * the rule to reuse existing components.
 
 */
export default function HostBreakoutPanel(props: BreakoutRoomsPanelProps) {
  return <BreakoutRoomsPanel {...props} />;
}
