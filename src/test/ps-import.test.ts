import psImport from '../ps-import';
import path from 'path';
import { loader } from '../index';

describe('ps-import', () => {
  const data = psImport(path.join(__dirname, '../../vendor/pokemon-showdown/.data-dist'));
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

    expect(getGen(5).moves.find(x => x.name === 'ViceGrip')).toBeDefined();
    expect(getGen(7).moves.find(x => x.name === 'Vice Grip')).toBeDefined();
    expect(getGen(8).moves.find(x => x.name === 'Vise Grip')).toBeDefined();
  });

  test('moves', () => {
    expect(getGen(8).moves.find(x => x.name === 'Karate Chop')).toBeUndefined();
  });

  test('z-moves', () => {
    expect(getGen(8).moves.find1(x => x.name === 'Absorb').zMove).toBeNull();
    expect(getGen(7).moves.find1(x => x.name === 'Absorb').zMove).not.toBeNull();
    expect(getGen(6).moves.find1(x => x.name === 'Absorb').zMove).toBeNull();
  });

  test('cap', () => {
    expect(getGen(3).species.find(x => x.name === 'Syclant')).toBeUndefined();
    expect(getGen(4).species.find1(x => x.name === 'Syclant').isNonstandard).toBe('CAP');
    expect(getGen(4).species.find(x => x.name === 'Equilibra')).toBeUndefined();
    expect(getGen(7).species.find1(x => x.name === 'Equilibra').isNonstandard).toBe('CAP');
  });

  test('alolas', () => {
    expect(getGen(5).species.find(x => x.name.includes('Alola'))).toBeUndefined();
  });

  test('pokestar', () => {
    expect(getGen(4).species.find(x => x.name.includes('Pokestar'))).toBeUndefined();
    // expect(getGen(5).species.find(x => x.name.includes('Pokestar'))).toBeDefined();
    expect(getGen(6).species.find(x => x.name.includes('Pokestar'))).toBeUndefined();
  });

  test('galars', () => {
    expect(getGen(7).species.find(x => x.name.includes('-Galar'))).toBeUndefined();
    expect(getGen(8).species.find(x => x.name.includes('-Galar'))).toBeDefined();
  });

  test('gmax', () => {
    expect(getGen(7).species.find(x => x.name.includes('-Gmax'))).toBeUndefined();
    const gmax = getGen(8).species.find(x => x.name.includes('-Gmax'));
    expect(gmax?.isBattleOnly).toBeDefined();
  });

  test('items', () => {
    expect(getGen(6).items.find(x => x.name === 'Lopunnite')).toBeDefined();
    expect(getGen(8).items.find(x => x.name === 'Lopunnite')).toBeUndefined();
    // We let Berserk Gene through even tho isNonstandard: Past, ensure we
    // didn't let this slip through as well
    expect(getGen(2).items.find(x => x.name === 'Lopunnite')).toBeUndefined();
    expect(getGen(2).items.find(x => x.name === 'Fairy Gem')).toBeUndefined();
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

    // Darmanitan and Darmanitan-Galar-Zen are not related via altBattleFormes
    // TODO: really need better Jest methods for comparing rich objects!
    const darmanitan = getGen(8).species.find1(x => x.name === 'Darmanitan');
    const darmanitanZen = getGen(8).species.find1(x => x.name === 'Darmanitan-Zen');
    const darmanitanGalar = getGen(8).species.find1(x => x.name === 'Darmanitan-Galar');
    const darmanitanZenGalar = getGen(8).species.find1(x => x.name === 'Darmanitan-Galar-Zen');
    expect(darmanitan.altBattleFormes.length).toBe(1);
    expect(darmanitan.altBattleFormes[0].name).toBe('Darmanitan-Zen');
    expect(darmanitanZen.altBattleFormes.length).toBe(1);
    expect(darmanitanZen.altBattleFormes[0].name).toBe('Darmanitan');
    expect(darmanitanGalar.altBattleFormes.length).toBe(1);
    expect(darmanitanGalar.altBattleFormes[0].name).toBe('Darmanitan-Galar-Zen');
    expect(darmanitanZenGalar.altBattleFormes.length).toBe(1);
    expect(darmanitanZenGalar.altBattleFormes[0].name).toBe('Darmanitan-Galar');

    // Meowth-Gmax should only be associated with Meowth
    expect(getGen(8).species.find1(x => x.name === 'Meowth-Gmax').altBattleFormes.length).toBe(1);
    expect(getGen(8).species.find1(x => x.name === 'Meowth-Gmax').altBattleFormes[0].name).toBe(
      'Meowth'
    );

    // Necrozma ultra should only be associated with Dawn-Wings/Dusk-Mane
    const necroUltra = getGen(7).species.find1(x => x.name === 'Necrozma-Ultra');
    expect(necroUltra.altBattleFormes.length).toBe(2);
    expect(new Set(necroUltra.altBattleFormes.map(x => x.name))).toEqual(
      new Set(['Necrozma-Dusk-Mane', 'Necrozma-Dawn-Wings'])
    );
  });

  test('forme learnsets', () => {
    expect(
      getGen(7)
        .species.find1(x => x.name === 'Necrozma-Dawn-Wings')
        .learnset.map(x => x.what.name)
        .includes('Photon Geyser')
    ).toBe(true);
    expect(
      getGen(7)
        .species.find1(x => x.name === 'Rotom-Wash')
        .learnset.map(x => x.what.name)
        .includes('Thunderbolt')
    ).toBe(true);
  });

  test('JSON roundtrippable', () => {
    // TODO: compare top-level too
    for (const gen of Object.values(data.gens)) {
      expect(gen).toStrictEqual(JSON.parse(JSON.stringify(gen)));
    }
  });

  test('Genfamilies', () => {
    const gen8 = getGen(8);
    const gen7 = getGen(7);
    const gen1 = getGen(1);
    const alakazam8 = gen8.species.find1(x => x.name === 'Alakazam');
    const alakazam1 = gen1.species.find1(x => x.name === 'Alakazam');

    // Huge output on failing test...
    expect(Object.is(alakazam1.genFamily.earliest, alakazam1)).toBe(true);
    expect(Object.is(alakazam1.genFamily.latest, alakazam8)).toBe(true);

    const gf1arr = Array.from(alakazam1.genFamily);
    const gf8arr = Array.from(alakazam8.genFamily);
    expect(gf1arr.length).toBe(8);

    // Huge output on failing test...
    for (let i = 0; i < 8; i++) {
      expect(Object.is(gf1arr[i], gf8arr[i])).toBe(true);
    }

    const megaMetagross = gen7.species.find1(x => x.name === 'Metagross-Mega');
    expect(Array.from(megaMetagross.genFamily).length).toBe(2);
  });

  test('Latest generation iterators', () => {
    // Cos it includes Berserk Gene
    expect(Array.from(dex.items).length).toBeGreaterThan(Array.from(getGen(7).items).length);
    // We can find an item with the same earliest/latest, right? (Also Berserk Gene)
    expect(dex.items.find(x => Object.is(x.earliest, x.latest))).toBeDefined();
  });

  // TODO remove when we have TS interfaces validation of data
  test('no nonstandard past', () => {
    for (const gen of dex.gens) {
      // TODO: datakind?
      for (const k of ['species', 'abilities', 'items', 'moves', 'types', 'moves'] as const) {
        for (const go of gen[k]) {
          expect((go as any).isNonstandard).not.toBe('Past');
        }
      }
    }
  });

  test('gen 8', () => {});

  test('moveflags', () => {
    expect(getGen(6).moves.find1(x => x.name === 'Earthquake').flags.nonsky).toBe(true);
    expect(getGen(6).moves.find1(x => x.name === 'Earthquake').flags.punch).toBe(false);
    expect(getGen(6).moves.find1(x => x.name === 'Earthquake').flags.protect).toBe(true);
    expect(getGen(6).moves.find1(x => x.name === 'Whirlwind').flags.protect).toBe(false);
    expect(getGen(6).moves.find1(x => x.name === 'Mirror Move').flags.mirror).toBe(false);
    expect(getGen(6).moves.find1(x => x.name === 'Earthquake').flags.mirror).toBe(true);
  });

  // TODO: move to a diff file?
  test('nice display', () => {
    expect(
      getGen(1)
        .species.find1(s => s.name === 'Slowbro')
        .toString()
    ).toBe('Slowbro');
    expect(
      getGen(1)
        .species.find1(s => s.name === 'Slowbro')
        .types.toString()
    ).toBe('Water/Psychic');
  });

  test('DPP/ADV hidden ability removal', () => {
    expect(
      getGen(3)
        .species.find1(x => x.name === 'Blaziken')
        .abilities.find(x => x.name === 'Speed Boost')
    ).toBeUndefined();
    expect(
      getGen(4)
        .species.find1(x => x.name === 'Blaziken')
        .abilities.find(x => x.name === 'Speed Boost')
    ).toBeUndefined();
    expect(
      getGen(5)
        .species.find1(x => x.name === 'Blaziken')
        .abilities.find(x => x.name === 'Speed Boost')
    ).toBeDefined();
  });

  test('Hidden Power', () => {
    expect(getGen(7).moves.find(x => x.name === 'Hidden Power')).toBeDefined();
    expect(getGen(7).moves.find(x => x.name === 'Hidden Power Fire')).toBeUndefined();
  });

  test('Learnset', () => {
    const gen3 = getGen(3);
    expect(
      gen3.species
        .find1(x => x.name === 'Blissey')
        .learnset.find(x => x.what.name === 'Aromatherapy')
    ).toBeDefined();
    expect(
      gen3.species.find1(x => x.name === 'Magneton').learnset.find(x => x.what.name === 'Explosion')
    ).toBeUndefined();
    expect(
      gen3.species
        .find1(x => x.name === 'Grumpig')
        .learnset.find(x => x.what.name === 'Thunder Wave')
    ).toBeUndefined();
    expect(
      gen3.species.find1(x => x.name === 'Steelix').learnset.find(x => x.what.name === 'Curse')
    ).toBeUndefined();
    expect(
      gen3.species.find1(x => x.name === 'Milotic').learnset.find(x => x.what.name === 'Haze')
    ).toBeUndefined();
    expect(
      gen3.species.find1(x => x.name === 'Latias').learnset.find(x => x.what.name === 'Trick')
    ).toBeUndefined();

    expect(
      getGen(8)
        .species.find1(x => x.name === 'Bisharp')
        .learnset.find(x => x.what.name === 'Knock Off')
    ).toBeDefined();

    expect(
      getGen(7)
        .species.find1(x => x.name === 'Pichu')
        .learnset.find(x => x.what.name === 'Surf')
    ).toBeUndefined();

    expect(
      getGen(8)
        .species.find1(x => x.name === 'Pichu')
        .learnset.find(x => x.what.name === 'Surf')
    ).toBeDefined();

    expect(
      getGen(8)
        .species.find1(x => x.name === 'Linoone')
        .learnset.find(x => x.what.name === 'Belly Drum')
    ).toBeDefined();

    expect(
      getGen(8)
        .species.find1(x => x.name === 'Linoone-Galar')
        .learnset.find(x => x.what.name === 'Belly Drum')
    ).toBeUndefined();
  });

  test('Move categories', () => {
    expect(getGen(3).moves.find1(x => x.name === 'Ice Punch').category).toBe('Special');
    expect(getGen(3).moves.find1(x => x.name === 'Toxic').category).toBe('Status');
    expect(getGen(4).moves.find1(x => x.name === 'Ice Punch').category).toBe('Physical');
    expect(getGen(4).moves.find1(x => x.name === 'Toxic').category).toBe('Status');
  });

  test('Tiers', () => {
    const darmanitanGalar = getGen(8).species.find1(x => x.name === 'Darmanitan-Galar');
    expect(darmanitanGalar.tier).toBe(darmanitanGalar.altBattleFormes[0].tier);
    const aegislash = getGen(8).species.find1(x => x.name === 'Aegislash');
    expect(aegislash.tier).toBe(aegislash.altBattleFormes[0].tier);
  });

  test('genesect', () => {
    expect(dex.species.find(x => x.latest.name === 'Genesect-Douse')).toBeDefined();
  });

  test('text', () => {
    const rs8 = getGen(8).abilities.find1(x => x.name === 'Rough Skin');
    const rs3 = getGen(3).abilities.find1(x => x.name === 'Rough Skin');

    expect(rs8.desc).not.toBe(rs3.desc);
  });
});
