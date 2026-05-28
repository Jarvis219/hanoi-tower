import { describe, it, expect } from 'vitest';
import { sliceBlock } from '../src/utils/math';

describe('sliceBlock', () => {
  const prev = { left: 100, right: 300 };

  it('returns perfect when centers align within tolerance', () => {
    const result = sliceBlock({ left: 102, right: 302 }, prev, 4);
    expect(result.kind).toBe('perfect');
    expect(result.newLeft).toBe(prev.left);
    expect(result.newRight).toBe(prev.right);
  });

  it('slices when offset right exceeds tolerance', () => {
    const result = sliceBlock({ left: 130, right: 330 }, prev, 4);
    expect(result.kind).toBe('sliced');
    expect(result.newLeft).toBe(130);
    expect(result.newRight).toBe(300);
    expect(result.debrisLeft).toBe(300);
    expect(result.debrisRight).toBe(330);
  });

  it('slices when offset left exceeds tolerance', () => {
    const result = sliceBlock({ left: 70, right: 270 }, prev, 4);
    expect(result.kind).toBe('sliced');
    expect(result.newLeft).toBe(100);
    expect(result.newRight).toBe(270);
    expect(result.debrisLeft).toBe(70);
    expect(result.debrisRight).toBe(100);
  });

  it('returns miss when no overlap', () => {
    const result = sliceBlock({ left: 400, right: 500 }, prev, 4);
    expect(result.kind).toBe('miss');
  });

  it('returns miss when blocks just touch (zero overlap)', () => {
    const result = sliceBlock({ left: 300, right: 400 }, prev, 4);
    expect(result.kind).toBe('miss');
  });
});
