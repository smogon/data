import { load, Dex, GenerationNumber } from '../index';

function head<T>(iter: Iterator<T>) {
  const v = iter.next();
  if (v.done === true) {
    throw new Error('empty iterator');
  }
  return v.value;
}

describe('lazy impl', () => {
  const dexSrc: Dex<
    'Plain',
    {
      gens: { num: GenerationNumber; species: 'present' };
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

  const dex = load(dexSrc);

  test('resolves', () => {
    const gen1 = head(dex.gens[Symbol.iterator]());
    const specie = head(gen1.species[Symbol.iterator]());
    expect(specie.name).toBe('Charmander');
    expect(specie.prevo).toBe(null);
    expect(specie.evos[0].name).toBe('Charmeleon');
  });
});
