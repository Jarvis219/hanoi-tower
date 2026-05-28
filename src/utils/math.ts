export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface Rect {
  left: number;
  right: number;
}

export interface SliceResult {
  kind: 'perfect' | 'sliced' | 'miss';
  newLeft: number;
  newRight: number;
  debrisLeft: number;
  debrisRight: number;
  delta: number;
}

export const sliceBlock = (
  current: Rect,
  previous: Rect,
  perfectTolerance: number,
): SliceResult => {
  const overlapLeft = Math.max(current.left, previous.left);
  const overlapRight = Math.min(current.right, previous.right);
  const overlap = overlapRight - overlapLeft;

  if (overlap <= 0) {
    return {
      kind: 'miss',
      newLeft: current.left,
      newRight: current.right,
      debrisLeft: current.left,
      debrisRight: current.right,
      delta: 0,
    };
  }

  const currCenter = (current.left + current.right) / 2;
  const prevCenter = (previous.left + previous.right) / 2;
  const delta = currCenter - prevCenter;

  if (Math.abs(delta) <= perfectTolerance) {
    return {
      kind: 'perfect',
      newLeft: previous.left,
      newRight: previous.right,
      debrisLeft: 0,
      debrisRight: 0,
      delta: 0,
    };
  }

  const debrisLeft = delta > 0 ? overlapRight : current.left;
  const debrisRight = delta > 0 ? current.right : overlapLeft;

  return {
    kind: 'sliced',
    newLeft: overlapLeft,
    newRight: overlapRight,
    debrisLeft,
    debrisRight,
    delta,
  };
};
