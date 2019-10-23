import { ID } from '../common';
import { Nature, Natures } from '../natures';

describe('Natures', () => {
  test('get', () => {
    const adamant = Natures.get('adamant' as ID);
    expect(adamant).toBeDefined();
    expect(adamant!.name).toBe('Adamant');
    expect(adamant!.mod).toBeDefined();
    expect(adamant!.mod!.plus).toBe('atk');
    expect(adamant!.mod!.minus).toBe('spa');
    expect(adamant!.toString()).toBe('Adamant');
    expect(JSON.stringify(adamant)).toBe(
      JSON.stringify({
        name: 'Adamant',
        mod: {
          plus: 'atk',
          minus: 'spa',
        },
      })
    );

    const serious = Natures.get('serious' as ID);
    expect(serious).toBeDefined();
    expect(serious!.mod).toBe(null);
    expect(serious!.toString()).toBe('Serious');
    expect(JSON.stringify(serious)).toBe(JSON.stringify({ name: 'Serious' }));

    expect(Natures.get('foo' as ID)).not.toBeDefined();
  });

  test('iteration', () => {
    expect(Array.from(Natures).length).toBe(25);
  });
});
