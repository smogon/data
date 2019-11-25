import { loader, Dex, GenerationNumber } from '../index';

describe('lazy impl', () => {
  const dexSrc1: Dex<
    'Plain',
    {
      gens: { num: GenerationNumber };
      species: {
        name: string;
        prevo: 'present';
        evos: 'present';
        learnset: 'present';
        types: 'present';
      };
      moves: { name: string };
      types: { name: string; moves: 'present' };
    }
  > = {
    gens: [
      {
        num: 1,
        species: [
          {
            name: 'Charmander',
            prevo: null,
            evos: [1],
            learnset: [{ what: 0, how: ['L9'] }],
            types: [1],
          },
          {
            name: 'Charmeleon',
            prevo: 0,
            evos: [2],
            learnset: [
              { what: 0, how: ['L1', 'L9'] },
              { what: 2, how: ['T'] },
            ],
            types: [1],
          },
          {
            name: 'Charizard',
            prevo: 1,
            evos: [],
            learnset: [
              { what: 0, how: ['L1', 'L9'] },
              { what: 2, how: ['T'] },
            ],
            types: [1, 2],
          },
          null,
          {
            name: 'Slowpoke',
            prevo: 1,
            evos: [5],
            learnset: [{ what: 1, how: ['T'] }],
            types: [3, 4],
          },
          {
            name: 'Slowbro',
            prevo: 4,
            evos: [],
            learnset: [{ what: 1, how: ['T'] }],
            types: [3, 4],
          },
        ],
        moves: [
          {
            name: 'Ember',
          },
          {
            name: 'Tri Attack',
          },
          {
            name: 'Body Slam',
          },
        ],
        types: [
          {
            name: 'Normal',
            moves: [1, 2],
          },
          {
            name: 'Fire',
            moves: [0],
          },
          {
            name: 'Flying',
            moves: [],
          },
          {
            name: 'Water',
            moves: [],
          },
          {
            name: 'Psychic',
            moves: [],
          },
        ],
      },
    ],
  };

  const dexSrc2: Dex<'Plain', { species: { heightm: number } }> = {
    gens: [
      {
        species: [
          {
            heightm: 0.6,
          },
          {
            heightm: 1.1,
          },
          {
            heightm: 1.7,
          },
          null,
          {
            heightm: 1.2,
          },
          {
            heightm: 1.6,
          },
        ],
      },
    ],
  };

  const dex = loader
    .load(dexSrc1)
    .load(dexSrc2)
    .construct();

  test('resolves', () => {
    const gen1 = dex.gens.find1(({ num }) => num === 1);
    const specie = gen1.species.find1(({ name }) => name === 'Charmander');
    expect(specie.prevo).toBe(null);
    expect(specie.heightm).toBe(0.6);
    expect(specie.evos[0].name).toBe('Charmeleon');
    expect(specie.evos[0].heightm).toBe(1.1);
  });

  test('ignores holes', () => {
    const gen1 = dex.gens.find1(({ num }) => num === 1);
    expect(gen1.species.find(({ name }) => name === 'Slowpoke')).toBeDefined();
    expect(Array.from(gen1.species).length).toBe(5);
  });

  test('backrefs', () => {
    // Let's ignore type safety for a second here and check if we actually
    // don't have anything in Move::species. This will also create a cached
    // entry in the Transformer, allowing us to check if the cached entry was
    // modified by constructBackref as well.
    const originalGen1 = dex.gens.find1(({ num }) => num === 1);
    const originalEmber = originalGen1.moves.find1(({ name }) => name === 'Ember');
    expect(() => (originalEmber as any).species).toThrow('not loaded');

    const backrefDex = dex
      .constructBackref(
        { path: ['species', 'learnset', 'what'] },
        { path: ['moves', 'species', 'what'] }
      )
      .constructBackref({ path: ['species', 'types'] }, { path: ['types', 'species'] })
      .constructBackref({ path: ['moves', 'type'], multiple: false }, { path: ['types', 'moves'] });

    const gen1 = backrefDex.gens.find1(({ num }) => num === 1);
    const specie = gen1.species.find1(({ name }) => name === 'Charmander');
    expect(specie.learnset[0].what.name).toBe('Ember');
    expect(specie.learnset[0].what.species[1].what.name).toBe('Charmeleon');

    const move = gen1.moves.find1(({ name }) => name === 'Ember');
    expect(move.species[0].what.name).toBe('Charmander');
    expect(move.species[1].what.name).toBe('Charmeleon');
    expect(move.species[3]).toBeUndefined();
    expect(move.type.name).toBe('Fire');

    const type = gen1.types.find1(({ name }) => name === 'Fire');
    expect(type.species[2].name).toBe('Charizard');
    expect(type.species[3]).toBeUndefined();

    // Fire -> Charizard -> Body Slam -> Normal -> Tri Attack -> Slowbro
    expect(type.species[2].learnset[1].what.type.moves[0].species[1].what.name).toBe('Slowbro');
  });
});
