import { toID } from '../common';

describe('ID', () => {
  test('toID', () => {
    expect(toID("Nature's Madness")).toBe('naturesmadness');
    expect(toID('10,000,000 Volt Thunderbolt')).toBe('10000000voltthunderbolt');
    expect(toID('undefined')).toBe('undefined');
    expect(toID('0')).toBe('0');
  });
});
