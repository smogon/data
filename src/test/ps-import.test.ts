import psImport from '../ps-import';
import path from 'path';
import { loader } from '../index';

describe('ps-import', () => {
  const data = psImport(path.join(__dirname, '../../vendor/Pokemon-Showdown/data'));
  const dex = loader.load(data).construct();

  function getGen(n: number) {
    return dex.gens.find1(({ num }) => num === n);
  }

  test('rby has the original 151', () => {
    // TODO: add a native length attribute?
    expect(Array.from(getGen(1).species).length).toBe(151);
  });

  test('rby has a non-empty learnset', () => {
    let hasNonEmpty = false;
    for (const specie of getGen(1).species) {
      hasNonEmpty = hasNonEmpty || specie.learnset.length > 0;
    }
    expect(hasNonEmpty).toBe(true);
  });

  test('gsc has 251 pokemon', () => {
    expect(Array.from(getGen(2).species).length).toBe(251);
  });

  test('rs has leftovers', () => {
    expect(getGen(3).items.find(x => x.name === 'Leftovers')).toBeDefined();
  });

  test('gs has berserk gene, but rs does not', () => {
    expect(getGen(2).items.find(x => x.name === 'Berserk Gene')).toBeDefined();
    expect(getGen(3).items.find(x => x.name === 'Berserk Gene')).toBeUndefined();
  });

  test('old gen names', () => {
    expect(getGen(6).moves.find(x => x.name === 'High Jump Kick')).toBeDefined();
    expect(getGen(6).moves.find(x => x.name === 'Hi Jump Kick')).toBeUndefined();
    expect(getGen(5).moves.find(x => x.name === 'High Jump Kick')).toBeUndefined();
    expect(getGen(5).moves.find(x => x.name === 'Hi Jump Kick')).toBeDefined();
  });

  test('z-moves', () => {
    expect(getGen(7).moves.find1(x => x.name === 'Absorb').zMove).not.toBeNull();
    expect(getGen(6).moves.find1(x => x.name === 'Absorb').zMove).toBeNull();
  });

  test('cap', () => {
    expect(getGen(3).species.find(x => x.name === 'Syclant')).toBeUndefined();
    expect(getGen(4).species.find1(x => x.name === 'Syclant').isNonstandard).toBe('CAP');
    expect(getGen(4).species.find(x => x.name === 'Equilibra')).toBeUndefined();
    expect(getGen(7).species.find1(x => x.name === 'Equilibra').isNonstandard).toBe('CAP');
  });

  test('altBattleFormes', () => {
    const venusaur = getGen(7).species.find1(x => x.name === 'Venusaur');
    const venusaurMega = getGen(7).species.find1(x => x.name === 'Venusaur-Mega');
    expect(venusaur.isBattleOnly).toBe(false);
    expect(venusaurMega.isBattleOnly).toBe(true);
    expect(venusaur.altBattleFormes[0]).toBe(venusaurMega);
    expect(venusaurMega.altBattleFormes[0]).toBe(venusaur);
    // shouldn't include out-of-battle otherFormes
    expect(getGen(7).species.find1(x => x.name === 'Rotom').altBattleFormes).toStrictEqual([]);
  });

  test('JSON roundtrippable', () => {
    // TODO: compare top-level too
    for (const gen of Object.values(data.gens)) {
      expect(gen).toStrictEqual(JSON.parse(JSON.stringify(gen)));
    }
  });
});
