import { loader, Dex, GenerationNumber } from '../index';

describe('lazy impl', () => {
  const dexSrc1: Dex<
    'Plain',
    {
      gens: { num: GenerationNumber };
      species: { name: string; prevo: 'present'; evos: 'present' };
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
          },
          {
            name: 'Charmeleon',
            prevo: 0,
            evos: [2],
          },
          {
            name: 'Charizard',
            prevo: 1,
            evos: [],
          },
          null,
          {
            name: 'Slowpoke',
            prevo: 1,
            evos: [5],
          },
          {
            name: 'Slowbro',
            prevo: 4,
            evos: [],
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
});
