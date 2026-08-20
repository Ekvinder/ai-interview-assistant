import type {
  WhiteboardScene,
  WhiteboardSceneData,
  WhiteboardElementsUpdate,
  WhiteboardMessage,
} from "@/types/whiteboard";

/**
 * Extracts only the serializable subset of appState.
 * Used exclusively for full-sync messages (new participant joins).
 *
 * We double-cast through `unknown` because TypeScript's AppState type has no
 * index signature — (appState as unknown as Record<string,unknown>) is the
 * correct, intentional escape hatch here.
 */
function extractSerializableAppState(
  appState: WhiteboardScene["appState"]
): WhiteboardSceneData["appState"] {
  const s = appState as unknown as Record<string, unknown>;
  return {
    viewBackgroundColor: (s.viewBackgroundColor as string) ?? "#ffffff",
    currentItemStrokeColor: (s.currentItemStrokeColor as string) ?? "#000000",
    currentItemBackgroundColor:
      (s.currentItemBackgroundColor as string) ?? "transparent",
    currentItemFillStyle: (s.currentItemFillStyle as string) ?? "hachure",
    currentItemStrokeWidth: (s.currentItemStrokeWidth as number) ?? 1,
    currentItemStrokeStyle: (s.currentItemStrokeStyle as string) ?? "solid",
    currentItemRoughness: (s.currentItemRoughness as number) ?? 1,
    currentItemOpacity: (s.currentItemOpacity as number) ?? 100,
    currentItemFontFamily: (s.currentItemFontFamily as number) ?? 1,
    currentItemFontSize: (s.currentItemFontSize as number) ?? 20,
    currentItemTextAlign: (s.currentItemTextAlign as string) ?? "left",
    currentItemStartArrowhead:
      (s.currentItemStartArrowhead as string | null) ?? null,
    currentItemEndArrowhead:
      (s.currentItemEndArrowhead as string | null) ?? "arrow",
    zoom: {
      value:
        ((s.zoom as { value: number } | undefined)?.value as number) ?? 1,
    },
    scrollX: (s.scrollX as number) ?? 0,
    scrollY: (s.scrollY as number) ?? 0,
    theme: (s.theme as string) ?? "dark",
  };
}

/**
 * Converts a full WhiteboardScene into the full wire-safe WhiteboardSceneData.
 * Only used when building full-sync messages (new participant joining).
 */
export function sceneToFullData(scene: WhiteboardScene): WhiteboardSceneData {
  return {
    elements: scene.elements,
    appState: extractSerializableAppState(scene.appState),
    files: scene.files,
  };
}

/**
 * Extracts only elements + files from a scene for incremental scene-update messages.
 * appState is intentionally excluded — applying remote appState mid-draw resets
 * the receiving participant's viewport and cancels their in-progress stroke.
 */
export function sceneToUpdate(
  scene: WhiteboardScene
): WhiteboardElementsUpdate {
  const s = scene.appState as unknown as Record<string, unknown>;
  return {
    elements: scene.elements,
    files: scene.files,
    appState: {
      scrollX: (s.scrollX as number) ?? 0,
      scrollY: (s.scrollY as number) ?? 0,
      zoom: {
        value: ((s.zoom as { value: number } | undefined)?.value as number) ?? 1,
      },
    }
  };
}



/**
 * Serializes a WhiteboardMessage to a Uint8Array for transmission via
 * LiveKit's useDataChannel send().
 */
export function serializeMessage(msg: WhiteboardMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

/**
 * Deserializes a Uint8Array received from a LiveKit DataChannel into a
 * WhiteboardMessage.  Returns null if the payload cannot be parsed or has an
 * unrecognized shape.
 */
export function deserializeMessage(
  payload: Uint8Array
): WhiteboardMessage | null {
  try {
    const text = new TextDecoder().decode(payload);
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as Record<string, unknown>).type === "string"
    ) {
      return parsed as WhiteboardMessage;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Legacy helpers kept for backward-compat ───────────────────────────────────

/** @deprecated Use sceneToFullData or sceneToUpdate instead. */
export function sceneToData(scene: WhiteboardScene): WhiteboardSceneData {
  return sceneToFullData(scene);
}

/** @deprecated Use serializeMessage / deserializeMessage instead. */
export function serializeScene(scene: WhiteboardScene): string {
  return JSON.stringify(sceneToFullData(scene));
}

/** @deprecated Use deserializeMessage instead. */
export function deserializeScene(value: string): WhiteboardSceneData {
  return JSON.parse(value) as WhiteboardSceneData;
}
