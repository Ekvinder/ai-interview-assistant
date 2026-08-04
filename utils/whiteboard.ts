
export function getReadOnlyState(
  isHost: boolean,
  whiteboardLocked: boolean
): boolean {
  if (isHost) return false;

  return whiteboardLocked;
}