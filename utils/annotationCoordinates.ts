/**
 * annotationCoordinates.ts
 *
 * Converts Excalidraw element geometry between physical stage pixels and a
 * logical [0, 1] coordinate space relative to the screen-share stage.
 *
 * COORDINATE MODEL
 * ─────────────────
 * Every element has:
 *   x, y        — absolute position of the element's top-left origin in scene space
 *   width, height — bounding box (all element types)
 *
 * LINEAR / FREEDRAW elements additionally have:
 *   points[]    — RELATIVE to (x, y).  [0,0] is the element's own origin.
 *                 Scaled by the same ratios as the bounding box.
 *   lastCommittedPoint — also relative to (x, y); same scaling.
 *
 * TEXT elements additionally have:
 *   fontSize    — a scalar in stage-space pixels; must scale with the stage.
 *                 We use scaleY (height ratio) to keep proportions stable when
 *                 width/height ratios differ slightly.
 *
 * IMAGE elements additionally have:
 *   crop        — {x, y, width, height} in INTRINSIC image pixels (not stage pixels).
 *                 Must NOT be scaled — it is a crop rectangle in pixel space of
 *                 the source image, independent of display size.
 *   scale       — [±1, ±1] flip flags; NOT spatial, must NOT be scaled.
 *
 * ELBOW ARROW elements additionally have:
 *   fixedSegments[].start / .end — relative LocalPoints; scaled like points[].
 *   startBinding.fixedPoint / endBinding.fixedPoint — normalised [0..1] attachment
 *                 ratios within the bound element; NOT stage-space, must NOT scale.
 *
 * THINGS WE NEVER SCALE
 * ──────────────────────
 *   pressures[]       (freedraw — 0..1 pen pressure, not spatial)
 *   strokeWidth       (aesthetic, not positional)
 *   opacity / roughness / seed / version / versionNonce
 *   ids, types, colors, text content, fontFamily, groupIds, etc.
 *   image.scale       (flip flags)
 *   image.crop        (intrinsic image pixels)
 *   binding.fixedPoint (attachment ratio 0..1 within bound element)
 */

type AnyElement = Record<string, unknown>;
type LocalPt = [number, number];

export interface StageSize {
  width: number;
  height: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scalePoint(pt: LocalPt, sx: number, sy: number): LocalPt {
  return [pt[0] * sx, pt[1] * sy];
}

function scalePoints(
  pts: readonly unknown[],
  sx: number,
  sy: number
): LocalPt[] {
  return (pts as LocalPt[]).map((p) => scalePoint(p, sx, sy));
}

function scaleLastCommittedPoint(
  lcp: unknown,
  sx: number,
  sy: number
): LocalPt | null {
  if (!Array.isArray(lcp) || lcp.length < 2) return lcp as null;
  return scalePoint(lcp as LocalPt, sx, sy);
}

/** Scale fixedSegments on elbow arrows — each segment has relative start/end points. */
function scaleFixedSegments(segs: unknown, sx: number, sy: number): unknown {
  if (!Array.isArray(segs)) return segs;
  return segs.map((seg: Record<string, unknown>) => ({
    ...seg,
    start: Array.isArray(seg.start) ? scalePoint(seg.start as LocalPt, sx, sy) : seg.start,
    end:   Array.isArray(seg.end)   ? scalePoint(seg.end   as LocalPt, sx, sy) : seg.end,
  }));
}

// ── per-element transform ─────────────────────────────────────────────────────

function scaleElement(el: AnyElement, sx: number, sy: number): AnyElement {
  const out: AnyElement = { ...el };

  // Universal: position and bounding box
  if (typeof el.x      === 'number') out.x      = el.x      * sx;
  if (typeof el.y      === 'number') out.y      = el.y      * sy;
  if (typeof el.width  === 'number') out.width  = el.width  * sx;
  if (typeof el.height === 'number') out.height = el.height * sy;

  // Relative points (line / arrow / freedraw)
  if (Array.isArray(el.points)) {
    out.points = scalePoints(el.points, sx, sy);
  }

  // lastCommittedPoint (line / arrow / freedraw) — relative, same scale
  if ('lastCommittedPoint' in el && el.lastCommittedPoint !== null) {
    out.lastCommittedPoint = scaleLastCommittedPoint(el.lastCommittedPoint, sx, sy);
  }

  // text: scale fontSize so text size tracks the stage
  if (el.type === 'text' && typeof el.fontSize === 'number') {
    // Use sy (height scale) as the primary text scaling axis
    out.fontSize = el.fontSize * sy;
  }

  // elbow arrow: scale fixedSegments (relative local points)
  if (el.type === 'arrow' && 'fixedSegments' in el && el.fixedSegments !== null) {
    out.fixedSegments = scaleFixedSegments(el.fixedSegments, sx, sy);
  }

  // image.crop is in INTRINSIC image pixels — NOT scaled
  // image.scale is ±1 flip flags — NOT scaled
  // binding.fixedPoint is a normalised ratio [0..1] — NOT scaled

  return out;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Normalizes an array of Excalidraw elements from physical stage pixels
 * to logical coordinates (divided by stage dimensions) for transport.
 */
export function normalizeElements(
  elements: readonly AnyElement[],
  stage: StageSize
): AnyElement[] {
  const { width: sw, height: sh } = stage;
  if (sw === 0 || sh === 0) return elements as AnyElement[];
  return elements.map((el) => scaleElement(el, 1 / sw, 1 / sh));
}

/**
 * Denormalizes an array of Excalidraw elements from logical coordinates
 * to the local participant's stage pixels before calling updateScene().
 */
export function denormalizeElements(
  elements: readonly AnyElement[],
  stage: StageSize
): AnyElement[] {
  const { width: sw, height: sh } = stage;
  if (sw === 0 || sh === 0) return elements as AnyElement[];
  return elements.map((el) => scaleElement(el, sw, sh));
}
