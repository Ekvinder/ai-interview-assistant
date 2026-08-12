/**
 * Determines whether the local participant should be in view-only (read-only)
 * mode on the whiteboard.
 *
 * Rules (host-controlled model):
 *  - The host is NEVER read-only regardless of any other state.
 *  - A participant is read-only unless they appear in `controllers` — the
 *    host-authoritative set of identities that have been granted draw permission.
 *  - `whiteboardLocked` is kept as a secondary guard: even if a participant is
 *    in `controllers`, the host can lock the board to pause all drawing.
 *
 * @param isHost            True when the local participant is the meeting host.
 * @param whiteboardLocked  True when the host has engaged the board-wide lock.
 * @param localIdentity     LiveKit identity of the local participant.
 * @param controllers       Set of identities with explicit drawing permission.
 */
export function getReadOnlyState(
  isHost: boolean,
  whiteboardLocked: boolean,
  localIdentity?: string,
  controllers?: ReadonlySet<string>
): boolean {
  // Host always has full drawing access.
  if (isHost) return false;

  // Board-wide lock overrides all participant permissions.
  if (whiteboardLocked) return true;

  // Participant has drawing permission only if the host explicitly granted it.
  if (localIdentity && controllers?.has(localIdentity)) return false;

  // Default: view-only.
  return true;
}

/**
 * Deterministic guard to prevent infinite DataChannel loops.
 * Computes a simple hash of the elements by summing their versions and length.
 * We use this to decide if an Excalidraw onChange event actually modified the
 * scene content or if it was just a remote update being applied (or a non-element change).
 */
export function getSceneVersion(elements: readonly { version?: number; versionNonce?: number }[]): number {
  return (
    elements.reduce(
      (acc, el) => acc + (el.version || 0) + (el.versionNonce || 0),
      0
    ) + elements.length
  );
}
