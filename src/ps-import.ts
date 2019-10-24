import { toID } from './common';
import { GenerationNumber, GENERATIONS } from './gens';
import path from 'path';
import fs from 'fs';
import * as Dex from './dex-interfaces';

////////////////////////////////////////////////////////////////////////////////
// Fundamental types
////////////////////////////////////////////////////////////////////////////////

type DataKind = 'species';
const DATAKINDS: Readonly<DataKind[]> = ['species'];

// This is generally an ID map, but in the case of types, it isn't
type IDMap = Record<string, any>;
type PSDex = Record<GenerationNumber, Record<DataKind, IDMap>>;

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

function requireMap(psDir: string, gen: GenerationNumber, name: string, key?: string): IDMap {
  const dirComponents = [process.cwd(), psDir];
  if (gen === 7) {
    dirComponents.push(`data`);
  } else {
    dirComponents.push('mods', `gen${gen}`);
  }

  const dir = path.resolve(...dirComponents);
  // We will return {} if we can't find the module file, so as a sanity check, at
  // least see if the directory exists.

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory ${psDir} doesn't exist`);
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

function requirePSDex(psDir: string) {
  const dex = {} as PSDex;
  for (const gen of GENERATIONS) {
    dex[gen] = {
      species: mergeMap(requireMap(psDir, gen, 'pokedex'), requireMap(psDir, gen, 'formats-data')),
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

function isAlola(s: any) {
  return s.forme !== undefined && s.forme.startsWith('Alola');
}

const PREDS = {
  1: {
    species: (s: any) => 1 <= s.num && s.num <= 151 && !isMega(s) && !isAlola(s),
  },
  2: {
    species: (s: any) => 1 <= s.num && s.num <= 251 && !isMega(s) && !isAlola(s),
  },
  3: {
    species: (s: any) => 1 <= s.num && s.num <= 386 && !isMega(s) && !isAlola(s),
  },
  4: {
    species: (s: any) => 1 <= s.num && s.num <= 493 && !isMega(s) && !isAlola(s),
  },
  5: {
    species: (s: any) => 1 <= s.num && s.num <= 649 && !isMega(s) && !isAlola(s),
  },
  6: {
    species: (s: any) => 1 <= s.num && s.num <= 721 && !isAlola(s),
  },
  7: {
    species: (s: any) => 1 <= s.num,
  },
};

function filterPSDex(dex: PSDex) {
  for (const gen of GENERATIONS) {
    for (const k of DATAKINDS) {
      const map = dex[gen][k];
      for (const id in dex[gen][k]) {
        const obj = map[id];
        if ((obj.gen !== undefined && obj.gen !== gen) || !PREDS[gen][k](obj)) {
          delete map[id];
        }
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Species
////////////////////////////////////////////////////////////////////////////////

function transformSpecies(speciesIn: IDMap): Dex.PlainSpecies[] {
  const speciesOut: Dex.PlainSpecies[] = [];
  const speciesMap: Map<string, number> = new Map();

  let i = 0;
  for (const id in speciesIn) {
    speciesMap.set(id, i);
    i++;
  }

  for (const [id, specieIn] of Object.entries(speciesIn)) {
    const specieOut: Dex.PlainSpecies = {
      name: specieIn.species,
      prevo: null,
      evos: [],
    };

    const prevoId = speciesMap.get(specieIn.prevo);
    if (prevoId !== undefined) {
      specieOut.prevo = prevoId;
    }

    if (specieIn.evos !== undefined) {
      for (const evo of specieIn.evos) {
        const evoId = speciesMap.get(evo);
        if (evoId !== undefined) {
          specieOut.evos.push(evo.species);
        }
      }
    }

    speciesOut.push(specieOut);
  }

  return speciesOut;
}

function transformPSDex(dexIn: PSDex): Dex.PlainDex {
  const dexOut: Dex.PlainDex = { gens: [] };
  for (const gen of GENERATIONS) {
    const genIn = dexIn[gen];
    const genOut = {
      num: gen,
      species: transformSpecies(genIn.species),
    };
    dexOut.gens[gen] = genOut;
  }
  return dexOut;
}

////////////////////////////////////////////////////////////////////////////////
// Putting it all together...
////////////////////////////////////////////////////////////////////////////////

export default function(psDir: string): Dex.PlainDex {
  const dexIn = requirePSDex(psDir);
  inheritPSDex(dexIn);
  filterPSDex(dexIn);
  const dexOut = transformPSDex(dexIn);
  return dexOut;
}
