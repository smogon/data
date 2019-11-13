import psImport from '../ps-import';
import path from 'path';

// Gens here will be 0-indexed

describe('ps-import', () => {
  const data = psImport(path.join(__dirname, '../../vendor/Pokemon-Showdown/data'));
  test('rby has the original 151', () => {
    expect(data.gens[0].species.length).toBe(151);
  });

  test('rby has a non-empty learnset', () => {
    let hasNonEmpty = false;
    for (const specie of data.gens[1].species) {
      hasNonEmpty = hasNonEmpty || specie.learnset.length > 0;
    }
    expect(hasNonEmpty).toBe(true);
  });

  test('gsc has 251 pokemon', () => {
    expect(data.gens[1].species.length).toBe(251);
  });

  test('rs has leftovers', () => {
    expect(data.gens[2].items.find(x => x.name === 'Leftovers')).toBeDefined();
  });

  test('gs has berserk gene, but rs does not', () => {
    expect(data.gens[1].items.find(x => x.name === 'Berserk Gene')).toBeDefined();
    expect(data.gens[2].items.find(x => x.name === 'Berserk Gene')).toBeUndefined();
  });

  test('old gen names', () => {
    expect(data.gens[5].moves.find(x => x.name === 'High Jump Kick')).toBeDefined();
    expect(data.gens[5].moves.find(x => x.name === 'Hi Jump Kick')).toBeUndefined();
    expect(data.gens[4].moves.find(x => x.name === 'High Jump Kick')).toBeUndefined();
    expect(data.gens[4].moves.find(x => x.name === 'Hi Jump Kick')).toBeDefined();
  });

  test('z-moves', () => {
    expect(data.gens[6].moves.find(x => x.name === 'Absorb')?.zMove).not.toBeNull();
    expect(data.gens[5].moves.find(x => x.name === 'Absorb')?.zMove).toBeNull();
  });

  test('JSON roundtrippable', () => {
    // TODO: compare top-level too
    for (const gen of Object.values(data.gens)) {
      expect(gen).toStrictEqual(JSON.parse(JSON.stringify(gen)));
    }
  });
});
