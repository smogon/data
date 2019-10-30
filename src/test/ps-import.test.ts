import psImport from '../ps-import';
import path from 'path';

describe('ps-import', () => {
  const data = psImport(path.join(__dirname, '../../vendor/Pokemon-Showdown/data'));
  test('rby has the original 151', () => {
    expect(data.gens[1].species.length).toBe(151);
  });
});
