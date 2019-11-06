import psImport from '../ps-import';
import path from 'path';

describe('ps-import', () => {
  const data = psImport(path.join(__dirname, '../../vendor/Pokemon-Showdown/data'));
  test('rby has the original 151', () => {
    expect(data.gens[1].species.length).toBe(151);
  });

  test('gsc has 251 pokemon', () => {
    expect(data.gens[2].species.length).toBe(251);
  });

  test('rs has leftovers', () => {
    expect(data.gens[3].items.find(x => x.name === 'Leftovers')).toBeDefined();
  });

  test('gs has berserk gene, but rs does not', () => {
    expect(data.gens[2].items.find(x => x.name === 'Berserk Gene')).toBeDefined();
    expect(data.gens[3].items.find(x => x.name === 'Berserk Gene')).toBeUndefined();
  });
});
