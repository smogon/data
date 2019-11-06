import { toID } from './common';
import { GenerationNumber, GENERATIONS } from './gens';
import path from 'path';
import fs from 'fs';
import * as Dex from './dex-interfaces';

////////////////////////////////////////////////////////////////////////////////
// Fundamental types
////////////////////////////////////////////////////////////////////////////////

type DataKind = 'species' | 'abilities' | 'items';
const DATAKINDS: Readonly<DataKind[]> = ['species', 'abilities', 'items'];

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
    if (map1[id] === undefined) map1[id] = { inherit: true };
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
        requireMap(psDataDir, gen, 'formats-data')
      ),
      abilities: requireMap(psDataDir, gen, 'abilities'),
      items: requireMap(psDataDir, gen, 'items'),
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
      objTo = mapTo[id] = { inherit: true };
    }
    if (objTo.inherit) {
      delete objTo.inherit;
      Object.assign(objTo, { ...objFrom, ...objTo });
    }
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
  },
  2: {
    species: (s: any) => 1 <= s.num && s.num <= 251 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => false,
    items: (i: any) => true,
  },
  3: {
    species: (s: any) => 1 <= s.num && s.num <= 386 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => a.num > 0 && a.num <= 76,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 376,
  },
  4: {
    species: (s: any) => 1 <= s.num && s.num <= 493 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => a.num <= 123,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 536,
  },
  5: {
    species: (s: any) => 1 <= s.num && s.num <= 649 && !isMega(s) && !isAlolaOrStarter(s),
    abilities: (a: any) => a.num <= 164,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 576,
  },
  6: {
    species: (s: any) => 1 <= s.num && s.num <= 721 && !isAlolaOrStarter(s),
    abilities: (a: any) => a.num <= 191,
    items: (i: any) => i.isNonstandard === undefined && i.num <= 688,
  },
  7: {
    species: (s: any) => 1 <= s.num,
    abilities: (a: any) => true,
    items: (i: any) => i.isNonstandard === undefined,
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

type PSExt = {
  gens: { num: GenerationNumber; species: 'present'; abilities: 'present'; items: 'present' };
  species: { name: string; prevo: 'present'; evos: 'present'; abilities: 'present' };
  abilities: { name: string };
  items: { name: string };
};

function transformSpecies(dexMap: DexMap, speciesIn: IDMap): Array<Dex.Species<'Plain', PSExt>> {
  const speciesOut: Array<Dex.Species<'Plain', PSExt>> = [];

  for (const [id, specieIn] of Object.entries(speciesIn)) {
    const specieOut: Dex.Species<'Plain', PSExt> = {
      name: specieIn.species,
      prevo: null,
      evos: [],
      abilities: [],
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
    };

    itemsOut.push(itemOut);
  }

  return itemsOut;
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
