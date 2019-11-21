import { toID } from './common';
import { GenerationNumber, GENERATIONS } from './gens';
import { StatsTable } from './stats';
import path from 'path';
import fs from 'fs';
import * as Dex from './dex-interfaces';

////////////////////////////////////////////////////////////////////////////////
// Fundamental types
////////////////////////////////////////////////////////////////////////////////

const DATAKINDS = ['species', 'abilities', 'items', 'moves', 'types'] as const;
type DataKind = typeof DATAKINDS[number];

const EXTRAKINDS = ['formatsData', 'learnsets'] as const;
type ExtraKind = typeof EXTRAKINDS[number];

// This is generally an ID map, but in the case of types, it isn't
type IDMap = Record<string, any>;
type PSDexStage1 = Record<GenerationNumber, Record<DataKind | ExtraKind, IDMap>>;
type PSDexGen = Record<DataKind, IDMap>;
type PSDexStage2 = Record<GenerationNumber, PSDexGen>;

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

function requireMap(psDataDir: string, gen: GenerationNumber, name: string, key?: string): IDMap {
  const dirComponents = [process.cwd(), psDataDir];
  if (gen !== 8) {
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

// Typechart isn't an IDMap... put a name attr (required) and index by id (for uniformity)
function fixNonIDMap(mapIn: IDMap): IDMap {
  const mapOut = {} as IDMap;
  for (const [name, obj] of Object.entries(mapIn)) {
    // Dark, Steel in gen 1
    // Can't skip, entry needed for gen filter
    if (obj !== null) {
      obj.name = name;
    }
    mapOut[toID(name)] = obj;
  }
  return mapOut;
}

function requirePSDex(psDataDir: string): PSDexStage1 {
  const dex = {} as PSDexStage1;
  for (const gen of GENERATIONS) {
    dex[gen] = {
      species: requireMap(psDataDir, gen, 'pokedex'),
      formatsData: requireMap(psDataDir, gen, 'formats-data'),
      learnsets: requireMap(psDataDir, gen, 'learnsets'),
      abilities: requireMap(psDataDir, gen, 'abilities'),
      items: requireMap(psDataDir, gen, 'items'),
      moves: requireMap(psDataDir, gen, 'moves'),
      types: fixNonIDMap(requireMap(psDataDir, gen, 'typechart')),
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

function mergeMap(map1: IDMap, map2: IDMap) {
  // Must be map1, we want to ignore entries in map2 that don't exist
  // for example, formats-data has mons that don't exist in pokedex
  for (const id in map1) {
    Object.assign(map1[id], map2[id]);
  }
}

// pairs([A, B, C]) = [{from: A, to: B}, {from: B, to: C}]
function* pairs<T>(array: T[]) {
  for (let i = 0; i < array.length - 1; i++) {
    yield { from: array[i], to: array[i + 1] };
  }
}

function inheritPSDex(dex: PSDexStage1): PSDexStage2 {
  for (const { from: genFrom, to: genTo } of pairs(Array.from(GENERATIONS).reverse())) {
    for (const k of [...DATAKINDS, ...EXTRAKINDS]) {
      inheritMap(dex[genFrom][k], dex[genTo][k]);
    }
  }

  for (const gen of GENERATIONS) {
    // The merge here must happen after inheritance.  Also, it must happen
    // before generation filtering, as (at least) the isNonstandard property is
    // used
    mergeMap(dex[gen].species, dex[gen].formatsData);
    delete dex[gen].formatsData;

    mergeMap(dex[gen].species, dex[gen].learnsets);
    delete dex[gen].learnsets;

    // Inherit data from base formes
    for (const specie of Object.values(dex[gen].species)) {
      if (specie.baseSpecies !== undefined) {
        const baseSpecie = dex[gen].species[toID(specie.baseSpecies)];
        Object.assign(specie, { ...baseSpecie, ...specie });
      }
    }
  }

  return dex;
}

////////////////////////////////////////////////////////////////////////////////
// Filtering
////////////////////////////////////////////////////////////////////////////////

// Limits from sim/dex-data.ts}

function isMega(s: any) {
  return ['Mega', 'Mega-X', 'Mega-Y', 'Primal'].includes(s.forme);
}

const PREDS = {
  species(gen: GenerationNumber, s: any) {
    // TODO Missingno, we don't have a "bird" type yet
    if (s.isNonstandard === 'Glitch') {
      return false;
    }

    if (s.isNonstandard === 'LGPE' && gen !== 7) {
      return false;
    }

    if (s.isNonstandard === 'Pokestar' && gen !== 5) {
      return false;
    }

    if (isMega(s) && gen < 6) {
      return false;
    }

    if (
      s.forme !== undefined &&
      (s.forme.startsWith('Alola') || s.forme === 'Starter') &&
      gen < 7
    ) {
      return false;
    }

    if (s.forme !== undefined && (s.forme.endsWith('Galar') || s.forme === 'Gmax') && gen < 8) {
      return false;
    }

    switch (gen) {
      case 8:
        return true;
      case 7:
        return s.num <= 809;
      case 6:
        return s.num <= 721;
      case 5:
        return s.num <= 649;
      case 4:
        return s.num <= 493;
      case 3:
        return s.num <= 386;
      case 2:
        return s.num <= 251;
      case 1:
        return s.num <= 151;
    }
  },

  abilities(gen: GenerationNumber, a: any) {
    switch (gen) {
      case 8:
        return true;
      case 7:
        return a.num <= 233;
      case 6:
        return a.num <= 191;
      case 5:
        return a.num <= 164;
      case 4:
        return a.num <= 123;
      case 3:
        return a.num <= 76;
      case 2:
      case 1:
        return false;
    }
  },

  items(gen: GenerationNumber, i: any) {
    switch (gen) {
      case 8:
        return true;
      case 7:
        return i.num <= 689;
      case 6:
        return i.num <= 688;
      case 5:
        return i.num <= 576;
      case 4:
        return i.num <= 536;
      case 3:
        return i.num <= 376;
      case 2:
        /* Rest should be filtered out by explicit gen. 0 is berserk gene */
        return 0 <= i.num;
      case 1:
        return false;
    }
  },

  moves(gen: GenerationNumber, m: any) {
    // TODO Magikarp's Revenge, not sure what to do here
    if (m.isNonstandard === 'Custom') {
      return false;
    }

    if (m.isNonstandard === 'LGPE' && gen !== 7) {
      return false;
    }

    switch (gen) {
      case 8:
        return true;
      case 7:
        return m.num <= 742;
      case 6:
        return m.num <= 621;
      case 5:
        return m.num <= 559;
      case 4:
        return m.num <= 467;
      case 3:
        return m.num <= 354;
      case 2:
        return m.num <= 251;
      case 1:
        return m.num <= 165;
    }
  },

  types(gen: GenerationNumber, t: any) {
    if (gen < 8) {
      return t !== null;
    } else {
      return true;
    }
  },
};

// Names in gen > 5 => names in gen <= 5
// TODO Maybe move to a diff file?
const renames = new Map([
  // Moves
  ['Ancient Power', 'AncientPower'],
  ['Bubble Beam', 'BubbleBeam'],
  ['Double Slap', 'DoubleSlap'],
  ['Dragon Breath', 'DragonBreath'],
  ['Dynamic Punch', 'DynamicPunch'],
  ['Extreme Speed', 'ExtremeSpeed'],
  ['Feint Attack', 'Faint Attack'],
  ['Feather Dance', 'FeatherDance'],
  ['Grass Whistle', 'GrassWhistle'],
  ['High Jump Kick', 'Hi Jump Kick'],
  ['Poison Powder', 'PoisonPowder'],
  ['Sand Attack', 'Sand-Attack'],
  ['Self-Destruct', 'Selfdestruct'],
  ['Smelling Salts', 'SmellingSalt'],
  ['Smokescreen', 'SmokeScreen'],
  ['Soft-Boiled', 'Softboiled'],
  ['Solar Beam', 'SolarBeam'],
  ['Sonic Boom', 'SonicBoom'],
  ['Thunder Punch', 'ThunderPunch'],
  ['Thunder Shock', 'ThunderShock'],
  ['Vice Grip', 'ViceGrip'],

  // Abilities
  ['Compound Eyes', 'Compoundeyes'],
  ['Lightning Rod', 'Lightningrod'],

  // Items
  ['Balm Mushroom', 'BalmMushroom'],
  ['Black Glasses', 'BlackGlasses'],
  ['Bright Powder', 'BrightPowder'],
  ['Deep Sea Scale', 'DeepSeaScale'],
  ['Deep Sea Tooth', 'DeepSeaTooth'],
  ['Energy Powder', 'EnergyPowder'],
  ['Never-Melt Ice', 'NeverMeltIce'],
  ['Paralyze Heal', 'Parlyz Heal'],
  ['Rage Candy Bar', 'RageCandyBar'],
  ['Silver Powder', 'SilverPowder'],
  ['Thunder Stone', 'Thunderstone'],
  ['Tiny Mushroom', 'TinyMushroom'],
  ['Twisted Spoon', 'TwistedSpoon'],
  ['X Defense', 'X Defend'],
  ['X Sp. Atk', 'X Special'],
]);

const idGens = new Map([
  // Species
  ['volkritter', [5, 6, 7]],
  ['privatyke', [4, 5, 6, 7]],
  ['volkraken', [5, 6, 7]],
  ['voodoom', [4, 5, 6, 7]],
  ['mollux', [5, 6, 7]],
  ['aurumoth', [5, 6, 7]],
  ['argalis', [5, 6, 7]],
  ['cupra', [5, 6, 7]],
  ['pajantom', [7]],
  ['brattler', [5, 6, 7]],
  ['syclant', [4, 5, 6, 7]],
  ['scratchet', [5, 6, 7]],
  ['kitsunoh', [4, 5, 6, 7]],
  ['fidgit', [4, 5, 6, 7]],
  ['cyclohm', [4, 5, 6, 7]],
  ['tactite', [4, 5, 6, 7]],
  ['arghonaut', [4, 5, 6, 7]],
  ['floatoy', [6, 7]],
  ['necturine', [5, 6, 7]],
  ['snugglow', [6, 7]],
  ['breezi', [4, 5, 6, 7]],
  ['caribolt', [7]],
  ['flarelm', [4, 5, 6, 7]],
  ['malaconda', [5, 6, 7]],
  ['necturna', [5, 6, 7]],
  ['pyroak', [4, 5, 6, 7]],
  ['tomohawk', [5, 6, 7]],
  ['mumbao', [7]],
  ['pluffle', [6, 7]],
  ['jumbao', [7]],
  ['kerfluffle', [6, 7]],
  ['stratagem', [4, 5, 6, 7]],
  ['crucibelle', [6, 7]],
  ['krilowatt', [4, 5, 6, 7]],
  ['cawdet', [5, 6, 7]],
  ['syclar', [4, 5, 6, 7]],
  ['plasmanta', [6, 7]],
  ['rebble', [4, 5, 6, 7]],
  ['cawmodore', [5, 6, 7]],
  ['equilibra', [7]],
  ['revenankh', [4, 5, 6, 7]],
  ['embirch', [4, 5, 6, 7]],
  ['snaelstrom', [7]],
  ['caimanoe', [6, 7]],
  ['colossoil', [4, 5, 6, 7]],
  ['smokomodo', [7]],
  ['naviathan', [6, 7]],
  ['voodoll', [4, 5, 6, 7]],
  // TODO Double check later.
  ['fawnifer', [7]],
  ['electrelk', [7]],
  ['smogecko', [7]],
  ['smoguana', [7]],
  ['swirlpool', [7]],
  ['coribalis', [7]],

  // Moves
  ['paleowave', [4, 5, 6, 7]],
  ['shadowstrike', [4, 5, 6, 7]],

  // Abilities
  ['mountaineer', [4, 5, 6, 7]],
  ['rebound', [4, 5, 6, 7]],
  ['persistent', [4, 5, 6, 7]],

  // Items
  ['crucibellite', [6, 7]],
]);

//  After this point generation-agnostic processing should be possible
function filterPSDex(dex: PSDexStage2) {
  const idMap = {} as Record<DataKind, Map<string, number>>;

  for (const k of DATAKINDS) {
    idMap[k] = new Map();
  }

  for (const gen of GENERATIONS) {
    for (const k of DATAKINDS) {
      const map = dex[gen][k];
      for (const id in dex[gen][k]) {
        const obj = map[id];

        const supplementalGens = idGens.get(id);

        let inGen;
        if (obj.isNonstandard === 'Past') {
          inGen = false;
        } else if (
          obj.gen !== undefined &&
          // This can be either null or undefined
          !obj.isNonstandard
        ) {
          inGen = gen >= obj.gen;
        } else if (supplementalGens !== undefined) {
          inGen = supplementalGens.includes(gen);
        } else {
          inGen = PREDS[k](gen, obj);
        }

        if (!inGen) {
          delete map[id];
          continue;
        }

        // Genfamily id
        let __id = idMap[k].get(id);
        if (__id === undefined) {
          __id = idMap[k].size;
          idMap[k].set(id, __id);
        }
        obj.__id = __id;

        if (gen !== 7) {
          // TODO cleaner way of doing this, just need the test to pass b4 commit
          delete obj.zMovePower;
        }
        if (gen <= 5 && 'name' in obj) {
          obj.name = renames.get(obj.name) ?? obj.name;
        }
        // Delete hidden abilities prior to generation 5
        if (gen < 5 && 'abilities' in obj) {
          if ("H" in obj.abilities){
            delete obj.abilities.H;
          }
        }

        // Gen 2 items, and maybe eventually some < Gen 8 ones?
        obj.desc = obj.desc?.replace(/^\(Gen \w\) /, '');
        obj.shortDesc = obj.shortDesc?.replace(/^\(Gen \w\) /, '');
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Massage data
////////////////////////////////////////////////////////////////////////////////

export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type Nonstandard = 'CAP' | 'LGPE' | 'Pokestar' | null;
export type MoveTarget =
  // single-target
  | 'Normal'
  | 'Any'
  | 'AdjacentAlly'
  | 'AdjacentFoe'
  | 'AdjacentAllyOrSelf'
  // single-target, automatic
  | 'Self'
  | 'RandomNormal'
  // spread
  | 'AllAdjacent'
  | 'AllAdjacentFoes'
  // side and field
  | 'AllySide'
  | 'FoeSide'
  | 'All';

export type PSExt = {
  gens: {
    num: GenerationNumber;
  };
  species: {
    num: number;
    name: string;
    prevo: 'present';
    evos: 'present';
    types: 'present';
    abilities: 'present';
    learnset: 'present';
    baseStats: StatsTable;
    isNonstandard: Nonstandard;
    isBattleOnly: boolean;
    altBattleFormes: 'present';
    // TODO: what to do with ()
    tier: string;
    heightm: number;
    weightkg: number;
    // doublesTier: string
  };
  abilities: { name: string; shortDesc: string; desc: string; isNonstandard: Nonstandard };
  items: { name: string; shortDesc: string; desc: string; isNonstandard: Nonstandard };
  moves: {
    name: string;
    shortDesc: string;
    desc: string;
    type: 'present';
    basePower: number;
    pp: number;
    accuracy: number | 'Bypass';
    priority: number;
    category: MoveCategory;
    zMove: {
      power: number;
    } | null;
    isNonstandard: Nonstandard;
    target: MoveTarget;
  };
  types: { name: string };
};

function isBattleOnly(specieIn: any) {
  return specieIn.battleOnly ?? isMega(specieIn);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TRANSFORMS = {
  species(dexIn: PSDexGen, specieIn: any): Dex.Species<'Plain', PSExt> {
    const id = toID(specieIn.species);

    const specieOut: Dex.Species<'Plain', PSExt> = {
      num: specieIn.num,
      name: specieIn.species,
      prevo: dexIn.species[specieIn.prevo ?? '']?.__id ?? null,
      evos: [],
      abilities: [],
      types: [],
      learnset: [],
      baseStats: specieIn.baseStats,
      isNonstandard: specieIn.isNonstandard ?? null,
      isBattleOnly: isBattleOnly(specieIn),
      altBattleFormes: [],
      tier: specieIn.tier,
      heightm: specieIn.heightm,
      weightkg: specieIn.weightkg,
      // Can be undefined
      // doublesTier: specieIn.doublesTier
    };

    if (!isBattleOnly(specieIn)) {
      for (const otherForme of specieIn.otherFormes ?? []) {
        // PS mixes in-battle & out-of-battle formes, untangle
        const forme = dexIn.species[otherForme];
        if (forme !== undefined && isBattleOnly(forme)) {
          specieOut.altBattleFormes.push(forme.__id);
        }
      }
    } else {
      // No convenient indexing; loop through and find what we are an otherForme of.
      for (const specieIn2 of Object.values(dexIn.species)) {
        if (isBattleOnly(specieIn2)) continue;
        if (specieIn2.otherFormes?.includes(id)) {
          specieOut.altBattleFormes.push(specieIn2.__id);
        }
      }
    }

    for (const evoId of specieIn.evos ?? []) {
      const evo = dexIn.species[evoId];
      if (evo !== undefined) {
        specieOut.evos.push(evo.__id);
      }
    }

    for (const abilityName of Object.values(specieIn.abilities)) {
      const ability = dexIn.abilities[toID(abilityName as string)];
      if (ability !== undefined) {
        specieOut.abilities.push(ability.__id);
      }
    }

    for (const typeName of specieIn.types) {
      const type = dexIn.types[toID(typeName as string)];
      if (type !== undefined) {
        specieOut.types.push(type.__id);
      }
    }

    // Pokestars have a missing learnset
    for (const [moveId, how] of Object.entries(specieIn.learnset ?? [])) {
      const move = dexIn.moves[moveId];
      if (move !== undefined) {
        specieOut.learnset.push({ what: move.__id, how: how as Dex.MoveSource[] });
      }
    }

    return specieOut;
  },

  abilities(dexIn: PSDexGen, abilityIn: any): Dex.Ability<'Plain', PSExt> {
    return {
      name: abilityIn.name,
      shortDesc: abilityIn.shortDesc ?? abilityIn.desc,
      desc: abilityIn.desc ?? abilityIn.shortDesc,
      isNonstandard: abilityIn.isNonstandard ?? null,
    };
  },

  items(dexIn: PSDexGen, itemIn: any): Dex.Item<'Plain', PSExt> {
    return {
      name: itemIn.name,
      shortDesc: itemIn.shortDesc ?? itemIn.desc,
      desc: itemIn.desc ?? itemIn.shortDesc,
      isNonstandard: itemIn.isNonstandard ?? null,
    };
  },

  moves(dexIn: PSDexGen, moveIn: any): Dex.Move<'Plain', PSExt> {
    // TODO, add to old gen typechart?
    if (moveIn.type === '???') {
      moveIn.type = 'Normal';
    }
    return {
      name: moveIn.name,
      type: dexIn.types[toID(moveIn.type)].__id,
      shortDesc: moveIn.shortDesc ?? moveIn.desc,
      desc: moveIn.desc ?? moveIn.shortDesc,
      basePower: moveIn.basePower,
      accuracy: moveIn.accuracy === true ? 'Bypass' : moveIn.accuracy,
      pp: moveIn.pp,
      priority: moveIn.priority,
      category: moveIn.category,
      zMove:
        moveIn.zMovePower !== undefined
          ? {
              power: moveIn.zMovePower,
            }
          : null,
      isNonstandard: moveIn.isNonstandard ?? null,
      target: capitalize(moveIn.target) as MoveTarget,
    };
  },
  types(dexIn: PSDexGen, typeIn: any): Dex.Type<'Plain', PSExt> {
    return {
      name: typeIn.name,
    };
  },
};

// Fill holes in array with null, so it is JSON roundtrippable
function fillArray<T>(arr: Array<T | null>) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === undefined) arr[i] = null;
  }
}

function transformPSDex(dexIn: PSDexStage2): Dex.Dex<'Plain', PSExt> {
  const dexOut: Dex.Dex<'Plain', PSExt> = { gens: [] };
  for (const gen of GENERATIONS) {
    const genIn = dexIn[gen];
    const genOut = {
      num: gen,
    } as Dex.Generation<'Plain', PSExt>;
    for (const k of DATAKINDS) {
      const arr: any[] = [];

      for (const v of Object.values(genIn[k])) {
        arr[v.__id] = TRANSFORMS[k](genIn, v);
      }

      fillArray(arr);

      genOut[k] = arr;
    }
    dexOut.gens.push(genOut);
  }
  return dexOut;
}

////////////////////////////////////////////////////////////////////////////////
// Putting it all together...
////////////////////////////////////////////////////////////////////////////////

export default function(psDataDir: string): Dex.Dex<'Plain', PSExt> {
  const dexIn = inheritPSDex(requirePSDex(psDataDir));
  filterPSDex(dexIn);
  const dexOut = transformPSDex(dexIn);
  return dexOut;
}
