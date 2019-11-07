import { loader, Dex, GenerationNumber } from '../index';

function head<T>(iter: Iterator<T>) {
  const v = iter.next();
  if (v.done === true) {
    throw new Error('empty iterator');
  }
  return v.value;
}

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
        ],
      },
    ],
  };

  const dex = loader
    .load(dexSrc1)
    .load(dexSrc2)
    .construct();

  test('resolves', () => {
    const gen1 = head(dex.gens[Symbol.iterator]());
    const specie = head(gen1.species[Symbol.iterator]());
    expect(specie.name).toBe('Charmander');
    expect(specie.prevo).toBe(null);
    expect(specie.heightm).toBe(0.6);
    expect(specie.evos[0].name).toBe('Charmeleon');
    expect(specie.evos[0].heightm).toBe(1.1);
  });
});
