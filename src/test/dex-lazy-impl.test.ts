import * as I from '../dex-interfaces';
import Dex from '../dex-lazy-impl';

describe('lazy impl', () => {
  const dexSrc: I.PlainDex = {
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

  const dex = new Dex(dexSrc);

  test('resolves', () => {
    const gen1 = dex.gens[Symbol.iterator]().next().value;
    const specie = gen1.species[Symbol.iterator]().next().value;
    expect(specie.name).toBe('Charmander');
    expect(specie.prevo).toBe(null);
    expect(specie.evos[0].name).toBe('Charmeleon');
  });
});
