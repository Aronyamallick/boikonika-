import { levelFor, xpForLevel } from './gamification.service';

describe('levels', () => {
  it('starts every level at 50·n·(n−1) XP', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    for (let level = 1; level <= 30; level++) {
      expect(levelFor(xpForLevel(level))).toBe(level);
      if (level > 1) expect(levelFor(xpForLevel(level) - 1)).toBe(level - 1);
    }
    expect(levelFor(0)).toBe(1);
    expect(levelFor(-50)).toBe(1);
  });
});
