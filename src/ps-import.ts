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

    // num filters out rockruffdusk, pokestargiant2, pokestargiantpropo2
    if (s.num === undefined) {
      return false;
    }

    if (isMega(s) && gen < 6) {
      return false;
    }

    if (
      s.forme !== undefined &&
      (s.forme.startsWith('Alola') || s.forme === 'Starter') &&
      gen < 5
    ) {
      return false;
    }

    switch (gen) {
      case 7:
        return true;
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
    if (a.name === 'No Ability') {
      return false;
    }

    switch (gen) {
      case 7:
        return true;
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
    if (i.isNonstandard === 'Past' && gen !== 2) {
      return false;
    }

    switch (gen) {
      case 7:
        return true;
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
      case 7:
        return true;
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
    if (gen < 7) {
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

function filterPSDex(dex: PSDex) {
  for (const gen of GENERATIONS) {
    for (const k of DATAKINDS) {
      const map = dex[gen][k];
      for (const id in dex[gen][k]) {
        const obj = map[id];

        const supplementalGens = idGens.get(id);

        if (
          (obj.gen !== undefined && gen < obj.gen) ||
          (supplementalGens !== undefined && !supplementalGens.includes(gen)) ||
          !PREDS[k](gen, obj)
        ) {
          delete map[id];
        } else {
          if (gen !== 7) {
            // TODO cleaner way of doing this, just need the test to pass b4 commit
            delete obj.zMovePower;
          }
          if (gen <= 5 && 'name' in obj) {
            obj.name = renames.get(obj.name) ?? obj.name;
          }
        }
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Massage data
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

export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type Nonstandard = 'CAP' | 'LGPE' | 'Pokestar' | null;

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
  };
  types: { name: string };
};

function isBattleOnly(specieIn: any) {
  return specieIn.battleOnly ?? isMega(specieIn);
}

function transformSpecies(dexMap: DexMap, speciesIn: IDMap): Array<Dex.Species<'Plain', PSExt>> {
  const speciesOut: Array<Dex.Species<'Plain', PSExt>> = [];

  for (const [id, specieIn] of Object.entries(speciesIn)) {
    // Sometimes other formes don't have tiers. Find its parent forme
    if (specieIn.tier === undefined) {
      for (const [id2, specieIn2] of Object.entries(speciesIn)) {
        for (const otherForme of specieIn2.otherFormes ?? []) {
          if (otherForme === id) {
            specieIn.tier = specieIn2.tier;
          }
        }
      }
    }

    const specieOut: Dex.Species<'Plain', PSExt> = {
      num: specieIn.num,
      name: specieIn.species,
      prevo: null,
      evos: [],
      abilities: [],
      types: [],
      learnset: [],
      baseStats: specieIn.baseStats,
      isNonstandard: specieIn.isNonstandard ?? null,
      isBattleOnly: isBattleOnly(specieIn),
      altBattleFormes: [],
      tier: specieIn.tier,
      // Can be undefined
      // doublesTier: specieIn.doublesTier
    };

    if (!isBattleOnly(specieIn)) {
      for (const otherForme of specieIn.otherFormes ?? []) {
        // PS mixes in-battle & out-of-battle formes, untangle
        const formeId = dexMap.species.get(otherForme);
        if (formeId !== undefined && isBattleOnly(speciesIn[otherForme])) {
          specieOut.altBattleFormes.push(formeId);
        }
      }
    } else {
      // No convenient indexing; loop through and find what we are an otherForme of.
      for (const [id2, specieIn2] of Object.entries(speciesIn)) {
        if (isBattleOnly(specieIn2)) continue;
        for (const otherForme of specieIn2.otherFormes ?? []) {
          if (otherForme === id) {
            // Guaranteed to be in this gen, silence type checker
            specieOut.altBattleFormes.push(dexMap.species.get(id2)!);
          }
        }
      }
    }

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
      shortDesc: abilityIn.shortDesc ?? abilityIn.desc,
      desc: abilityIn.desc ?? abilityIn.shortDesc,
      isNonstandard: abilityIn.isNonstandard ?? null,
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
      shortDesc: itemIn.shortDesc ?? itemIn.desc,
      desc: itemIn.desc ?? itemIn.shortDesc,
      isNonstandard: itemIn.isNonstandard ?? null,
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
    dexOut.gens.push(genOut);
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
