import { describe, test, expect } from 'bun:test';
import { nextTabId } from '@/lib/pricing/tab-nav';

const ids = ['a', 'b', 'c'];

describe('nextTabId', () => {
  test('ArrowRight moves forward and wraps', () => {
    expect(nextTabId(ids, 'a', 'ArrowRight')).toBe('b');
    expect(nextTabId(ids, 'c', 'ArrowRight')).toBe('a');
  });
  test('ArrowLeft moves back and wraps', () => {
    expect(nextTabId(ids, 'b', 'ArrowLeft')).toBe('a');
    expect(nextTabId(ids, 'a', 'ArrowLeft')).toBe('c');
  });
  test('Home / End jump to the ends', () => {
    expect(nextTabId(ids, 'b', 'Home')).toBe('a');
    expect(nextTabId(ids, 'a', 'End')).toBe('c');
  });
  test('other keys and unknown ids yield null', () => {
    expect(nextTabId(ids, 'a', 'Enter')).toBeNull();
    expect(nextTabId(ids, 'zz', 'ArrowRight')).toBeNull();
    expect(nextTabId([], 'a', 'Home')).toBeNull();
  });
});
