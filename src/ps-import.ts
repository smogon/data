import { toID } from './common';
import { GenerationNumber, GENERATIONS } from './gens';
import path from 'path';
import fs from 'fs';
import * as Dex from './dex-interfaces';

////////////////////////////////////////////////////////////////////////////////
// Fundamental types
////////////////////////////////////////////////////////////////////////////////

type DataKind = 'species' | 'abilities' | 'items' | 'moves' | 'types';
const DATAKINDS: Readonly<DataKind[]> = ['species', 'abilities', 'items', 'moves', 'types'];

// This is generally an ID map, but in the case of types, it isn't
type IDMap = Record<string, any>;
type PSDex = Record<GenerationNumber, Record<DataKind, IDMap>>;

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

function requireMap(psDataDir: string, gen: GenerationNumber, name: string, key?: string): IDMap {
  const dirComponents = [process.cwd(), psDataDir];
  if (gen !== 7) {
    dirComponents.push('mods', `gen${gen}`);
  }

  const dir = path.resolve(...dirComponents);
  // We will return {} if we can't find the module file, so as a sanity check, at
  // least see if the directory exists.

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory ${psDataDir} doesn't exist`);
  }

  const filename = path.join(dir, name);

  try {
    const mod = require(filename);
    if (key !== undefined) {
      return mod[key];
    } else {
      const vs = Object.values(mod);
      if (vs.length === 1) {
        return vs[0] as IDMap;
      } else {
        throw new Error('More than 1 export');
      }
    }
  } catch (e) {
    return {};
  }
}

function mergeMap(map1: IDMap, map2: IDMap) {
  for (const id in map2) {
    if (map1[id] === undefined) map1[id] = {};
    Object.assign(map1[id], map2[id]);
  }
  return map1;
}

function requirePSDex(psDataDir: string) {
  const dex = {} as PSDex;
  for (const gen of GENERATIONS) {
    dex[gen] = {
      species: mergeMap(
        requireMap(psDataDir, gen, 'pokedex'),
        mergeMap(
          requireMap(psDataDir, gen, 'formats-data'),
          requireMap(psDataDir, gen, 'learnsets')
        )
      ),
      abilities: requireMap(psDataDir, gen, 'abilities'),
      items: requireMap(psDataDir, gen, 'items'),
      moves: requireMap(psDataDir, gen, 'moves'),
      types: requireMap(psDataDir, gen, 'typechart'),
    };
  }

  return dex;
}

////////////////////////////////////////////////////////////////////////////////
// Inheritance
////////////////////////////////////////////////////////////////////////////////

function inheritMap(mapFrom: IDMap, mapTo: IDMap) {
  for (const id in mapFrom) {
    const objFrom = mapFrom[id];
    let objTo = mapTo[id];
    if (!objTo) {
      objTo = mapTo[id] = {};
    }
    if (objTo.inherit) {
      delete objTo.inherit;
    }
    Object.assign(objTo, { ...objFrom, ...objTo });
  }
}

// pairs([A, B, C]) = [{from: A, to: B}, {from: B, to: C}]
function* pairs<T>(array: T[]) {
  for (let i = 0; i < array.length - 1; i++) {
    yield { from: array[i], to: array[i + 1] };
  }
}

function inheritPSDex(dex: PSDex) {
  for (const { from: genFrom, to: genTo } of pairs(Array.from(GENERATIONS).reverse())) {
    for (const k of DATAKINDS) {
      inheritMap(dex[genFrom][k], dex[genTo][k]);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Filtering
////////////////////////////////////////////////////////////////////////////////

// Limits from sim/dex-data.ts

function isMega(s: any) {
  return ['Mega', 'Mega-X', 'Mega-Y', 'Primal'].includes(s.forme);
}

function isAlolaOrStarter(s: any) {
  return s.forme !== undefined && (s.forme.startsWith('Alola') || s.forme === 'Starter');
}

const PREDS = {
  1: {
    species: (s: any) => 1 <= s.num && s.num <= 151 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => false,
    items: (i: any) => false,
    moves: (m: any) => 1 <= m.num && 1 <= m.num && m.num <= 165,
    types: (t: any) => t !== null,
  },
  2: {
    species: (s: any) => 1 <= s.num && s.num <= 251 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => false,
    items: (i: any) =>
      0 <= i.num /* Rest should be filtered out by explicit gen. 0 is berserk gene */,
    moves: (m: any) => 1 <= m.num && m.num <= 251,
    types: (t: any) => t !== null,
  },
  3: {
    species: (s: any) => 1 <= s.num && s.num <= 386 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => 1 <= a.num && a.num <= 76,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 376,
    moves: (m: any) => 1 <= m.num && m.num <= 354,
    types: (t: any) => t !== null,
  },
  4: {
    species: (s: any) => 1 <= s.num && s.num <= 493 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => 1 <= a.num && a.num <= 123,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 536,
    moves: (m: any) => 1 <= m.num && m.num <= 467,
    types: (t: any) => t !== null,
  },
  5: {
    species: (s: any) => 1 <= s.num && s.num <= 649 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => 1 <= a.num && a.num <= 164,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 576,
    moves: (m: any) => 1 <= m.num && m.num <= 559,
    types: (t: any) => t !== null,
  },
  6: {
    species: (s: any) => 1 <= s.num && s.num <= 721 && !isAlolaOrStarter(s),
    abilities: (a: any) => 1 <= a.num && a.num <= 191,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 688,
    moves: (m: any) => 1 <= m.num && m.num <= 621,
    types: (t: any) => t !== null,
  },
  7: {
    species: (s: any) => 1 <= s.num,
    abilities: (a: any) => 1 <= a.num,
    items: (i: any) => i.isNonstandard === undefined,
    moves: (m: any) => 1 <= m.num,
    types: (t: any) => true,
  },
};

function filterPSDex(dex: PSDex) {
  for (const gen of GENERATIONS) {
    for (const k of DATAKINDS) {
      const map = dex[gen][k];
      for (const id in dex[gen][k]) {
        const obj = map[id];
        if ((obj.gen !== undefined && gen < obj.gen) || !PREDS[gen][k](obj)) {
          delete map[id];
        }
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Species
////////////////////////////////////////////////////////////////////////////////

// Kinda similar name to IDMap, might want to call this something else, idk
type DexMap = Record<DataKind, Map<string, number>>;

function makeMap(dex: Record<DataKind, IDMap>) {
  const dexMap: DexMap = {} as DexMap;

  for (const k of DATAKINDS) {
    dexMap[k] = new Map();
    let i = 0;
    for (const id in dex[k]) {
      dexMap[k].set(id, i);
      i++;
    }
  }

  return dexMap;
}

// Use ?? when gts supports it
function nullCoalesce(x: any, y: any) {
  if (x === undefined || x === null) {
    return y;
  }
  return x;
}

type PSExt = {
  gens: {
    num: GenerationNumber;
    species: 'present';
    abilities: 'present';
    items: 'present';
    moves: 'present';
    types: 'present';
  };
  species: {
    name: string;
    prevo: 'present';
    evos: 'present';
    types: 'present';
    abilities: 'present';
    learnset: 'present';
  };
  abilities: { name: string; shortDesc: string; desc: string };
  items: { name: string; shortDesc: string; desc: string };
  moves: { name: string; shortDesc: string; desc: string; type: 'present' };
  types: { name: string };
};

function transformSpecies(dexMap: DexMap, speciesIn: IDMap): Array<Dex.Species<'Plain', PSExt>> {
  const speciesOut: Array<Dex.Species<'Plain', PSExt>> = [];

  for (const [id, specieIn] of Object.entries(speciesIn)) {
    const specieOut: Dex.Species<'Plain', PSExt> = {
      name: specieIn.species,
      prevo: null,
      evos: [],
      abilities: [],
      types: [],
      learnset: [],
    };

    const prevoId = dexMap.species.get(specieIn.prevo);
    if (prevoId !== undefined) {
      specieOut.prevo = prevoId;
    }

    if (specieIn.evos !== undefined) {
      for (const evo of specieIn.evos) {
        const evoId = dexMap.species.get(evo);
        if (evoId !== undefined) {
          specieOut.evos.push(evoId);
        }
      }
    }

    for (const ability of Object.values(specieIn.abilities)) {
      const abilityId = dexMap.abilities.get(toID(ability as string));
      if (abilityId !== undefined) {
        specieOut.abilities.push(abilityId);
      }
    }

    for (const type of specieIn.types) {
      // No toID call here!
      const typeId = dexMap.types.get(type);
      if (typeId !== undefined) {
        specieOut.types.push(typeId);
      }
    }

    for (const move in specieIn.learnset) {
      // No toID call here!
      const moveId = dexMap.moves.get(toID(move as string));
      if (moveId !== undefined) {
        specieOut.learnset.push(moveId);
      }
    }

    speciesOut.push(specieOut);
  }

  return speciesOut;
}

function transformAbilities(
  dexMap: DexMap,
  abilitiesIn: IDMap
): Array<Dex.Ability<'Plain', PSExt>> {
  const abilitiesOut: Array<Dex.Ability<'Plain', PSExt>> = [];

  for (const [id, abilityIn] of Object.entries(abilitiesIn)) {
    const abilityOut: Dex.Ability<'Plain', PSExt> = {
      name: abilityIn.name,
      shortDesc: nullCoalesce(abilityIn.shortDesc, abilityIn.desc),
      desc: nullCoalesce(abilityIn.desc, abilityIn.shortDesc),
    };

    abilitiesOut.push(abilityOut);
  }

  return abilitiesOut;
}

function transformItems(dexMap: DexMap, itemsIn: IDMap): Array<Dex.Item<'Plain', PSExt>> {
  const itemsOut: Array<Dex.Item<'Plain', PSExt>> = [];

  for (const [id, itemIn] of Object.entries(itemsIn)) {
    const itemOut: Dex.Item<'Plain', PSExt> = {
      name: itemIn.name,
      shortDesc: nullCoalesce(itemIn.shortDesc, itemIn.desc),
      desc: nullCoalesce(itemIn.desc, itemIn.shortDesc),
    };

    itemsOut.push(itemOut);
  }

  return itemsOut;
}

function transformMoves(dexMap: DexMap, movesIn: IDMap): Array<Dex.Move<'Plain', PSExt>> {
  const movesOut: Array<Dex.Move<'Plain', PSExt>> = [];

  for (const [id, moveIn] of Object.entries(movesIn)) {
    // TODO, add to old gen typechart?
    if (moveIn.type === '???') {
      moveIn.type = 'Normal';
    }
    const moveOut: Dex.Move<'Plain', PSExt> = {
      name: moveIn.name,
      type: dexMap.types.get(moveIn.type) as number,
      shortDesc: nullCoalesce(moveIn.shortDesc, moveIn.desc),
      desc: nullCoalesce(moveIn.desc, moveIn.shortDesc),
    };

    movesOut.push(moveOut);
  }

  return movesOut;
}

function transformTypes(dexMap: DexMap, typesIn: IDMap): Array<Dex.Type<'Plain', PSExt>> {
  const typesOut: Array<Dex.Type<'Plain', PSExt>> = [];

  // Not indexed by ID!
  for (const [name, typeIn] of Object.entries(typesIn)) {
    const typeOut: Dex.Type<'Plain', PSExt> = {
      name,
    };

    typesOut.push(typeOut);
  }

  return typesOut;
}

function transformPSDex(dexIn: PSDex): Dex.Dex<'Plain', PSExt> {
  const dexOut: Dex.Dex<'Plain', PSExt> = { gens: [] };
  for (const gen of GENERATIONS) {
    const genIn = dexIn[gen];
    const genMap = makeMap(genIn);
    const genOut: Dex.Generation<'Plain', PSExt> = {
      num: gen,
      species: transformSpecies(genMap, genIn.species),
      abilities: transformAbilities(genMap, genIn.abilities),
      items: transformItems(genMap, genIn.items),
      moves: transformMoves(genMap, genIn.moves),
      types: transformTypes(genMap, genIn.types),
    };
    dexOut.gens[gen] = genOut;
  }
  return dexOut;
}

////////////////////////////////////////////////////////////////////////////////
// Putting it all together...
////////////////////////////////////////////////////////////////////////////////

export default function(psDataDir: string): Dex.Dex<'Plain', PSExt> {
  const dexIn = requirePSDex(psDataDir);
  inheritPSDex(dexIn);
  filterPSDex(dexIn);
  const dexOut = transformPSDex(dexIn);
  return dexOut;
}
