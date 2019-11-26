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
type PSIDMap = Record<string, any>;
type PSDexStage1 = Record<
  GenerationNumber,
  { num: GenerationNumber } & Record<DataKind | ExtraKind, PSIDMap>
>;
type PSDexGen = { num: GenerationNumber } & Record<DataKind, PSIDMap>;
type PSDexStage2 = Record<GenerationNumber, PSDexGen>;

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

function requireMap(psDataDir: string, gen: GenerationNumber, name: string, key?: string): PSIDMap {
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
        return vs[0] as PSIDMap;
      } else {
        throw new Error('More than 1 export');
      }
    }
  } catch (e) {
    return {};
  }
}

// Typechart isn't an IDMap... put a name attr (required) and index by id (for uniformity)
function fixNonPSIDMap(mapIn: PSIDMap): PSIDMap {
  const mapOut = {} as PSIDMap;
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
      num: gen,
      species: requireMap(psDataDir, gen, 'pokedex'),
      formatsData: requireMap(psDataDir, gen, 'formats-data'),
      learnsets: requireMap(psDataDir, gen, 'learnsets'),
      abilities: requireMap(psDataDir, gen, 'abilities'),
      items: requireMap(psDataDir, gen, 'items'),
      moves: requireMap(psDataDir, gen, 'moves'),
      types: fixNonPSIDMap(requireMap(psDataDir, gen, 'typechart')),
    };
  }

  return dex;
}

////////////////////////////////////////////////////////////////////////////////
// Inheritance
////////////////////////////////////////////////////////////////////////////////

function inheritMap(mapFrom: PSIDMap, mapTo: PSIDMap) {
  for (const psid in mapFrom) {
    const objFrom = mapFrom[psid];
    let objTo = mapTo[psid];
    if (!objTo) {
      objTo = mapTo[psid] = { inherit: true };
    }
    if (objTo.inherit) {
      delete objTo.inherit;
      Object.assign(objTo, { ...objFrom, ...objTo });
    }
  }
}

function mergeMap(map1: PSIDMap, map2: PSIDMap) {
  // Must be map1, we want to ignore entries in map2 that don't exist
  // for example, formats-data has mons that don't exist in pokedex
  for (const psid in map1) {
    Object.assign(map1[psid], map2[psid]);
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
  return ['Mega', 'Mega-X', 'Mega-Y', 'Primal', 'Gmax'].includes(s.forme);
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

    if (s.isNonstandard === 'CAP') {
      throw new Error(`Missing CAP from supplemental gens list: ${s.species}`);
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

    if (s.forme !== undefined && (s.species.includes('-Galar') || s.forme === 'Gmax') && gen < 8) {
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
const renames: Map<string, Array<{ gen: GenerationNumber; name: string }>> = new Map([
  // Moves
  ['Ancient Power', [{ gen: 5, name: 'AncientPower' }]],
  ['Bubble Beam', [{ gen: 5, name: 'BubbleBeam' }]],
  ['Double Slap', [{ gen: 5, name: 'DoubleSlap' }]],
  ['Dragon Breath', [{ gen: 5, name: 'DragonBreath' }]],
  ['Dynamic Punch', [{ gen: 5, name: 'DynamicPunch' }]],
  ['Extreme Speed', [{ gen: 5, name: 'ExtremeSpeed' }]],
  ['Feint Attack', [{ gen: 5, name: 'Faint Attack' }]],
  ['Feather Dance', [{ gen: 5, name: 'FeatherDance' }]],
  ['Grass Whistle', [{ gen: 5, name: 'GrassWhistle' }]],
  ['High Jump Kick', [{ gen: 5, name: 'Hi Jump Kick' }]],
  ['Poison Powder', [{ gen: 5, name: 'PoisonPowder' }]],
  ['Sand Attack', [{ gen: 5, name: 'Sand-Attack' }]],
  ['Self-Destruct', [{ gen: 5, name: 'Selfdestruct' }]],
  ['Smelling Salts', [{ gen: 5, name: 'SmellingSalt' }]],
  ['Smokescreen', [{ gen: 5, name: 'SmokeScreen' }]],
  ['Soft-Boiled', [{ gen: 5, name: 'Softboiled' }]],
  ['Solar Beam', [{ gen: 5, name: 'SolarBeam' }]],
  ['Sonic Boom', [{ gen: 5, name: 'SonicBoom' }]],
  ['Thunder Punch', [{ gen: 5, name: 'ThunderPunch' }]],
  ['Thunder Shock', [{ gen: 5, name: 'ThunderShock' }]],
  [
    'Vise Grip',
    [
      { gen: 5, name: 'ViceGrip' },
      { gen: 7, name: 'Vice Grip' },
    ],
  ],

  // Abilities
  ['Compound Eyes', [{ gen: 5, name: 'Compoundeyes' }]],
  ['Lightning Rod', [{ gen: 5, name: 'Lightningrod' }]],

  // Items
  ['Balm Mushroom', [{ gen: 5, name: 'BalmMushroom' }]],
  ['Black Glasses', [{ gen: 5, name: 'BlackGlasses' }]],
  ['Bright Powder', [{ gen: 5, name: 'BrightPowder' }]],
  ['Deep Sea Scale', [{ gen: 5, name: 'DeepSeaScale' }]],
  ['Deep Sea Tooth', [{ gen: 5, name: 'DeepSeaTooth' }]],
  ['Energy Powder', [{ gen: 5, name: 'EnergyPowder' }]],
  ['Never-Melt Ice', [{ gen: 5, name: 'NeverMeltIce' }]],
  ['Paralyze Heal', [{ gen: 5, name: 'Parlyz Heal' }]],
  ['Rage Candy Bar', [{ gen: 5, name: 'RageCandyBar' }]],
  ['Silver Powder', [{ gen: 5, name: 'SilverPowder' }]],
  ['Thunder Stone', [{ gen: 5, name: 'Thunderstone' }]],
  ['Tiny Mushroom', [{ gen: 5, name: 'TinyMushroom' }]],
  ['Twisted Spoon', [{ gen: 5, name: 'TwistedSpoon' }]],
  ['X Defense', [{ gen: 5, name: 'X Defend' }]],
  ['X Sp. Atk', [{ gen: 5, name: 'X Special' }]],
]);

const idGens = new Map([
  // Species
  ['volkritter', [5, 6, 7, 8]],
  ['privatyke', [4, 5, 6, 7, 8]],
  ['volkraken', [5, 6, 7, 8]],
  ['voodoom', [4, 5, 6, 7, 8]],
  ['mollux', [5, 6, 7, 8]],
  ['aurumoth', [5, 6, 7, 8]],
  ['argalis', [5, 6, 7, 8]],
  ['cupra', [5, 6, 7, 8]],
  ['pajantom', [7, 8]],
  ['brattler', [5, 6, 7, 8]],
  ['syclant', [4, 5, 6, 7, 8]],
  ['scratchet', [5, 6, 7, 8]],
  ['kitsunoh', [4, 5, 6, 7, 8]],
  ['fidgit', [4, 5, 6, 7, 8]],
  ['cyclohm', [4, 5, 6, 7, 8]],
  ['tactite', [4, 5, 6, 7, 8]],
  ['arghonaut', [4, 5, 6, 7, 8]],
  ['floatoy', [6, 7, 8]],
  ['necturine', [5, 6, 7, 8]],
  ['snugglow', [6, 7, 8]],
  ['breezi', [4, 5, 6, 7, 8]],
  ['caribolt', [7, 8]],
  ['flarelm', [4, 5, 6, 7, 8]],
  ['malaconda', [5, 6, 7, 8]],
  ['necturna', [5, 6, 7, 8]],
  ['pyroak', [4, 5, 6, 7, 8]],
  ['tomohawk', [5, 6, 7, 8]],
  ['mumbao', [7, 8]],
  ['pluffle', [6, 7, 8]],
  ['jumbao', [7, 8]],
  ['kerfluffle', [6, 7, 8]],
  ['stratagem', [4, 5, 6, 7, 8]],
  ['crucibelle', [6, 7, 8]],
  ['crucibellemega', [6, 7]],
  ['krilowatt', [4, 5, 6, 7, 8]],
  ['cawdet', [5, 6, 7, 8]],
  ['syclar', [4, 5, 6, 7, 8]],
  ['plasmanta', [6, 7, 8]],
  ['rebble', [4, 5, 6, 7, 8]],
  ['cawmodore', [5, 6, 7, 8]],
  ['equilibra', [7, 8]],
  ['revenankh', [4, 5, 6, 7, 8]],
  ['embirch', [4, 5, 6, 7, 8]],
  ['snaelstrom', [7, 8]],
  ['caimanoe', [6, 7, 8]],
  ['colossoil', [4, 5, 6, 7, 8]],
  ['smokomodo', [7, 8]],
  ['naviathan', [6, 7, 8]],
  ['voodoll', [4, 5, 6, 7, 8]],
  // TODO Double check later.
  ['fawnifer', [7, 8]],
  ['electrelk', [7, 8]],
  ['smogecko', [7, 8]],
  ['smoguana', [7, 8]],
  ['swirlpool', [7, 8]],
  ['coribalis', [7, 8]],

  // Moves
  ['paleowave', [4, 5, 6, 7, 8]],
  ['shadowstrike', [4, 5, 6, 7, 8]],

  // Abilities
  ['mountaineer', [4, 5, 6, 7, 8]],
  ['rebound', [4, 5, 6, 7, 8]],
  ['persistent', [4, 5, 6, 7, 8]],

  // Items
  ['crucibellite', [6, 7]],
]);

const idSym = Symbol();

function filterPSDex(dex: PSDexStage2) {
  const idMap = {} as Record<DataKind, Map<string, number>>;

  for (const k of DATAKINDS) {
    idMap[k] = new Map();
  }

  for (const gen of GENERATIONS) {
    for (const k of DATAKINDS) {
      const map = dex[gen][k];
      for (const psid in dex[gen][k]) {
        const obj = map[psid];

        const supplementalGens = idGens.get(psid);

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
          delete map[psid];
          continue;
        }

        // Genfamily id
        let id = idMap[k].get(psid);
        if (id === undefined) {
          id = idMap[k].size;
          idMap[k].set(psid, id);
        }
        obj[idSym] = id;
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

function fixDesc(s: string) {
  return s.replace(/^\(Gen \w\) /, '');
}

function rename(num: GenerationNumber, newName: string): string {
  let oldName = newName;
  let oldGen = GENERATIONS[GENERATIONS.length - 1];
  for (const { gen, name } of renames.get(newName) ?? []) {
    if (num <= gen && gen < oldGen) {
      oldGen = gen;
      oldName = name;
    }
  }
  return oldName;
}

const TRANSFORMS = {
  species(dexIn: PSDexGen, specieIn: any): Dex.Species<'Plain', PSExt> {
    const psid = toID(specieIn.species);

    const specieOut: Dex.Species<'Plain', PSExt> = {
      num: specieIn.num,
      name: rename(dexIn.num, specieIn.species),
      prevo: dexIn.species[specieIn.prevo ?? '']?.[idSym] ?? null,
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

    if (
      dexIn.num === 7 /* Necrozma-Ultra doesn't exist in Gen 8, no altBattleFormes */ &&
      specieIn.species.startsWith('Necrozma')
    ) {
      switch (specieIn.species) {
        case 'Necrozma':
          break;
        case 'Necrozma-Dusk-Mane':
          specieOut.altBattleFormes.push(dexIn.species['necrozmaultra'][idSym]);
          break;
        case 'Necrozma-Dawn-Wings':
          specieOut.altBattleFormes.push(dexIn.species['necrozmaultra'][idSym]);
          break;
        case 'Necrozma-Ultra':
          specieOut.altBattleFormes.push(dexIn.species['necrozmaduskmane'][idSym]);
          specieOut.altBattleFormes.push(dexIn.species['necrozmadawnwings'][idSym]);
          break;
        default:
          throw new Error(`Unknown Necrozma ${specieIn.species}`);
      }
    } else if (!isBattleOnly(specieIn)) {
      for (const otherForme of specieIn.otherFormes ?? []) {
        // PS mixes in-battle & out-of-battle formes, untangle
        const forme = dexIn.species[otherForme];
        if (forme !== undefined && isBattleOnly(forme)) {
          specieOut.altBattleFormes.push(forme[idSym]);
        }
      }
    } else {
      // This only handles the case where an inBattle forme has one associated
      // out of battle forme. Anything else must be hardcoded.
      specieOut.altBattleFormes.push(dexIn.species[toID(specieIn.baseSpecies)][idSym]);
    }

    for (const evoId of specieIn.evos ?? []) {
      const evo = dexIn.species[evoId];
      if (evo !== undefined) {
        specieOut.evos.push(evo[idSym]);
      }
    }

    for (const [abilityType, abilityName] of Object.entries(specieIn.abilities)) {
      // Hidden abilities don't exist prior to gen 5
      if (dexIn.num < 5 && abilityType === 'H') {
        continue;
      }

      const ability = dexIn.abilities[toID(abilityName as string)];
      if (ability !== undefined) {
        specieOut.abilities.push(ability[idSym]);
      }
    }

    for (const typeName of specieIn.types) {
      const type = dexIn.types[toID(typeName as string)];
      if (type !== undefined) {
        specieOut.types.push(type[idSym]);
      }
    }

    let curSpecieIn = specieIn;
    while (true) {
      for (const [moveId, how] of Object.entries(
        curSpecieIn.learnset ?? [] /* Pokestars have a missing learnset */
      )) {
        const move = dexIn.moves[moveId];
        if (move !== undefined) {
          // See team-validator.ts. We ignore level check, ability check, mimic
          // glitch, limited egg moves, move evo carry count.
          //
          // Tradebacks are never considered part of the gen, for now.
          //
          // TODO: Parse MoveSource
          const howFiltered = [];
          for (const way of how as Dex.MoveSource[]) {
            const learnedGen = +way.charAt(0);
            if (learnedGen > dexIn.num) {
              continue;
            }
            howFiltered.push(way);
          }
          if (howFiltered.length > 0) {
            // TODO; MoveSource for preevo misleading. Need to extend this
            specieOut.learnset.push({ what: move[idSym], how: howFiltered as Dex.MoveSource[] });
          }
        }
      }

      if (curSpecieIn.prevo) {
        curSpecieIn = dexIn.species[curSpecieIn.prevo];
      } else if (
        /* logic copied from team-validator.ts, TODO test cases that exercise this logic */
        curSpecieIn.baseSpecies !== curSpecieIn.species &&
        (['Rotom', 'Necrozma'].includes(curSpecieIn.baseSpecies) || curSpecieIn.forme === 'Gmax')
      ) {
        curSpecieIn = dexIn.species[toID(curSpecieIn.baseSpecies)];
      } else {
        break;
      }

      // This can happen if prevo/baseSpecies added in later gen
      if (curSpecieIn === undefined) {
        break;
      }
    }

    return specieOut;
  },

  abilities(dexIn: PSDexGen, abilityIn: any): Dex.Ability<'Plain', PSExt> {
    return {
      name: rename(dexIn.num, abilityIn.name),
      shortDesc: fixDesc(abilityIn.shortDesc ?? abilityIn.desc),
      desc: fixDesc(abilityIn.desc ?? abilityIn.shortDesc),
      isNonstandard: abilityIn.isNonstandard ?? null,
    };
  },

  items(dexIn: PSDexGen, itemIn: any): Dex.Item<'Plain', PSExt> {
    return {
      name: rename(dexIn.num, itemIn.name),
      shortDesc: fixDesc(itemIn.shortDesc ?? itemIn.desc),
      desc: fixDesc(itemIn.desc ?? itemIn.shortDesc),
      isNonstandard: itemIn.isNonstandard ?? null,
    };
  },

  moves(dexIn: PSDexGen, moveIn: any): Dex.Move<'Plain', PSExt> {
    // TODO, add to old gen typechart?
    if (moveIn.type === '???') {
      moveIn.type = 'Normal';
    }
    return {
      name: rename(dexIn.num, moveIn.name),
      type: dexIn.types[toID(moveIn.type)][idSym],
      shortDesc: fixDesc(moveIn.shortDesc ?? moveIn.desc),
      desc: fixDesc(moveIn.desc ?? moveIn.shortDesc),
      basePower: moveIn.basePower,
      accuracy: moveIn.accuracy === true ? 'Bypass' : moveIn.accuracy,
      pp: moveIn.pp,
      priority: moveIn.priority,
      category: moveIn.category,
      zMove:
        dexIn.num === 7 && moveIn.zMovePower !== undefined
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
      name: rename(dexIn.num, typeIn.name),
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
        arr[v[idSym]] = TRANSFORMS[k](genIn, v);
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
