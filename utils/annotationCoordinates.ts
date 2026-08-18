/**
 * annotationCoordinates.ts
 *
 * Converts Excalidraw element geometry between physical stage pixels and a
 * logical [0, 1] coordinate space relative to the screen-share stage.
 *
 * WHY:
 *   Host stage 1200×675  →  element at x=600, y=300  →  logical (0.5, 0.444)
 *   Participant stage 800×450  →  renders at x=400, y=200
 *
 * This way the annotation stays at the same visual location regardless of
 * each participant's stage size.
 *
 * ELEMENT GEOMETRY:
 *   - (x, y) is the element's top-left origin in scene space
 *   - (width, height) are the bounding box dimensions
 *   - points[] are coordinates RELATIVE to (x, y) — they are NOT absolute
 *     screen positions.  We scale them by the same ratio without adding origin.
 */

type AnyElement = Record<string, unknown>;

export interface StageSize {
  width: number;
  height: number;
}

/**
 * Normalizes a single element's geometry from physical pixels → logical [0,1].
 * All other properties are preserved unchanged.
 */
function normalizeElement(el: AnyElement, stage: StageSize): AnyElement {
  const sw = stage.width;
  const sh = stage.height;

  const normalized: AnyElement = { ...el };

  if (typeof el.x === 'number') normalized.x = el.x / sw;
  if (typeof el.y === 'number') normalized.y = el.y / sh;
  if (typeof el.width === 'number') normalized.width = el.width / sw;
  if (typeof el.height === 'number') normalized.height = el.height / sh;

  // points are relative to (x, y) — scale by the same ratios
  if (Array.isArray(el.points)) {
    normalized.points = (el.points as [number, number][]).map(
      ([px, py]) => [px / sw, py / sh] as [number, number]
    );
  }

  return normalized;
}

/**
 * Denormalizes a single element's geometry from logical [0,1] → physical pixels.
 */
function denormalizeElement(el: AnyElement, stage: StageSize): AnyElement {
  const sw = stage.width;
  const sh = stage.height;

  const denormalized: AnyElement = { ...el };

  if (typeof el.x === 'number') denormalized.x = el.x * sw;
  if (typeof el.y === 'number') denormalized.y = el.y * sh;
  if (typeof el.width === 'number') denormalized.width = el.width * sw;
  if (typeof el.height === 'number') denormalized.height = el.height * sh;

  // points are relative to (x, y) — scale by the same ratios
  if (Array.isArray(el.points)) {
    denormalized.points = (el.points as [number, number][]).map(
      ([px, py]) => [px * sw, py * sh] as [number, number]
    );
  }

  return denormalized;
}

/**
 * Normalizes an array of Excalidraw elements from the host's stage pixels
 * to logical [0, 1] coordinates for transport.
 */
export function normalizeElements(
  elements: readonly AnyElement[],
  stage: StageSize
): AnyElement[] {
  if (stage.width === 0 || stage.height === 0) return elements as AnyElement[];
  return elements.map((el) => normalizeElement(el, stage));
}

/**
 * Denormalizes an array of Excalidraw elements from logical [0, 1] coordinates
 * to the local participant's stage pixels before calling updateScene().
 */
export function denormalizeElements(
  elements: readonly AnyElement[],
  stage: StageSize
): AnyElement[] {
  if (stage.width === 0 || stage.height === 0) return elements as AnyElement[];
  return elements.map((el) => denormalizeElement(el, stage));
}
