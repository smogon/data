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

const EXTRAKINDS = ['formatsData', 'learnsets', 'itemText', 'moveText', 'abilityText'] as const;
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

function requireText(psDataDir: string, name: string, key?: string): PSIDMap {
  const filename = path.resolve(process.cwd(), psDataDir, 'text', name);

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

function pluckGenText(gen: GenerationNumber, text: PSIDMap): PSIDMap {
  const result: PSIDMap = {};
  for (const psid in text) {
    result[psid] = gen === 8 ? {} : { inherit: true };
    if (gen === 8) {
      for (const k in text[psid]) {
        if (k.match(/^gen\d$/) !== null) {
          continue;
        } else {
          result[psid][k] = text[psid][k];
        }
      }
    } else {
      const textObj = text[psid][`gen${gen}`];
      Object.assign(result[psid], textObj);
    }
  }
  return result;
}

function requirePSDex(psDataDir: string): PSDexStage1 {
  const dex = {} as PSDexStage1;

  const text = {
    moves: requireText(psDataDir, 'moves'),
    items: requireText(psDataDir, 'items'),
    abilities: requireText(psDataDir, 'abilities'),
  };

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
      itemText: pluckGenText(gen, text.items),
      moveText: pluckGenText(gen, text.moves),
      abilityText: pluckGenText(gen, text.abilities),
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

    mergeMap(dex[gen].abilities, dex[gen].abilityText);
    delete dex[gen].abilityText;

    mergeMap(dex[gen].items, dex[gen].itemText);
    delete dex[gen].itemText;

    mergeMap(dex[gen].moves, dex[gen].moveText);
    delete dex[gen].moveText;
  }

  return dex;
}

////////////////////////////////////////////////////////////////////////////////
// Filtering
////////////////////////////////////////////////////////////////////////////////

// Limits from sim/dex-data.ts

function isMega(s: any) {
  return ['Mega', 'Mega-X', 'Mega-Y', 'Primal', 'Gmax'].includes(s.forme);
}

const PREDS = {
  species(gen: GenerationNumber, s: any) {
    if (s.isNonstandard === 'LGPE' && gen !== 7) {
      return false;
    }

    // Missingno, Pokestar
    if (s.isNonstandard === 'Custom' || s.isNonstandard === 'Unobtainable') {
      return false;
    }

    if (s.isNonstandard === 'CAP') {
      throw new Error(`Missing CAP from supplemental gens list: ${s.name}`);
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

    if (s.forme !== undefined && (s.name.includes('-Galar') || s.forme === 'Gmax') && gen < 8) {
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

    // PS has fake moves like "Hidden Power Fire". These all have id 'hiddenpower'.
    if (m.realMove === 'Hidden Power' && m.name !== 'Hidden Power') {
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
      // Remove types that don't exist in prev gens like Steel/Dark in Gen 1
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
  // TODO: add leek
]);

// PS doesn't always have enough information to figure out what generation something is in.
// TODO: move to diff file?
const idGens = new Map([
  // Species
  ['volkritter', [6, 7, 8]],
  ['privatyke', [4, 5, 6, 7, 8]],
  ['volkraken', [6, 7, 8]],
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
  ['astrolotl', [8]],
  ['justyke', [7, 8]],
  ['solotl', [8]],
  ['miasmaw', [8]],
  ['miasmite', [8]],

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

// Every object that survives the filter is assigned a number to this symbol to
// identify it. This number is the same across generations.
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
export type Nonstandard = 'CAP' | 'LGPE' | null;
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

export type MoveFlags = {
  authentic: boolean;
  bite: boolean;
  bullet: boolean;
  charge: boolean;
  contact: boolean;
  dance: boolean;
  defrost: boolean;
  distance: boolean;
  gravity: boolean;
  heal: boolean;
  mirror: boolean;
  mystery: boolean;
  nonsky: boolean;
  powder: boolean;
  protect: boolean;
  pulse: boolean;
  punch: boolean;
  recharge: boolean;
  reflectable: boolean;
  snatch: boolean;
  sound: boolean;
};

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
    flags: MoveFlags;
  };
  types: { name: string };
};

function isBattleOnly(specieIn: any) {
  return specieIn.battleOnly ?? isMega(specieIn);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Items that only exist in past generations redundantly indicate this fact in
// their descriptions. Strip out the redundancy.
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

// Only well-defined if guarded by isBattleOnly
function outOfBattleFormes(specieIn: any): string[] {
  let oob = [];
  const bo = specieIn.battleOnly;

  if (isMega(specieIn)) {
    oob = [specieIn.baseSpecies];
  } else if (bo === undefined) {
    oob = [];
  } else if (Array.isArray(bo)) {
    oob = bo;
  } else {
    oob = [bo];
  }

  if (oob.length === 0) {
    throw new Error(`${specieIn.name} has no out-of-battle formes`);
  }

  return oob.map(toID);
}

function getTier(dexIn: PSDexGen, specieIn: any): string {
  if (specieIn.tier !== undefined) {
    return specieIn.tier;
  }

  if (isBattleOnly(specieIn)) {
    for (const psid of outOfBattleFormes(specieIn)) {
      const tier = dexIn.species[psid]?.tier;
      if (tier !== undefined) {
        return tier;
      }
    }
  }

  const tier = dexIn.species[toID(specieIn.baseSpecies)]?.tier;
  if (tier === undefined) {
    throw new Error(`Can't figure out tier for ${specieIn.name} in Gen ${dexIn.num}`);
  }

  return tier;
}

const TRANSFORMS = {
  species(dexIn: PSDexGen, specieIn: any): Dex.Species<'Plain', PSExt> {
    const psid = toID(specieIn.name);

    const specieOut: Dex.Species<'Plain', PSExt> = {
      num: specieIn.num,
      name: rename(dexIn.num, specieIn.name),
      prevo: dexIn.species[toID(specieIn.prevo ?? '')]?.[idSym] ?? null,
      evos: [],
      abilities: [],
      types: [],
      learnset: [],
      baseStats: specieIn.baseStats,
      isNonstandard: specieIn.isNonstandard ?? null,
      isBattleOnly: isBattleOnly(specieIn),
      altBattleFormes: [],
      tier: getTier(dexIn, specieIn),
      heightm: specieIn.heightm,
      weightkg: specieIn.weightkg,
      // Can be undefined
      // doublesTier: specieIn.doublesTier
    };

    if (!isBattleOnly(specieIn)) {
      // Could search otherFormes here; treat inheritsFrom as the single source of truth
      for (const forme of Object.values(dexIn.species)) {
        if (isBattleOnly(forme) && outOfBattleFormes(forme).includes(psid)) {
          specieOut.altBattleFormes.push(forme[idSym]);
        }
      }
    } else {
      for (const oobId of outOfBattleFormes(specieIn)) {
        const oob = dexIn.species[oobId];
        if (oob !== undefined) {
          specieOut.altBattleFormes.push(oob[idSym]);
        }
      }
    }

    for (const evoId of specieIn.evos ?? []) {
      const evo = dexIn.species[toID(evoId)];
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
            // team-validator::allSources() doesn't let stuff trade before gen
            // 3, but the data files have an explicit learnset mod in 2, not
            // sure if this test is needed.
            if (
              dexIn.num >= 4 &&
              learnedGen <= 3 &&
              [
                'cut',
                'fly',
                'surf',
                'strength',
                'flash',
                'rocksmash',
                'waterfall',
                'dive',
              ].includes(moveId)
            ) {
              continue;
            }

            if (
              dexIn.num >= 5 &&
              learnedGen <= 4 &&
              ['cut', 'fly', 'surf', 'strength', 'rocksmash', 'waterfall', 'rockclimb'].includes(
                moveId
              )
            ) {
              continue;
            }

            // No tradebacks.
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

      // NOTE: we cannot inherit from baseSpecies, this would mean for example
      // that Zigzagoon-Galar inherits learnset from Zigzagoon
      if (curSpecieIn.prevo) {
        curSpecieIn = dexIn.species[toID(curSpecieIn.prevo)];
      } else if (curSpecieIn.changesFrom) {
        curSpecieIn = dexIn.species[toID(curSpecieIn.changesFrom)];
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
    let zMove: { power: number } | null = null;
    if (dexIn.num === 7 && moveIn.category !== 'Status') {
      let zMovePower = moveIn.zMovePower;

      if (!zMovePower) {
        let basePower = moveIn.basePower;
        if (Array.isArray(moveIn.multihit)) basePower *= 3;
        if (!basePower) {
          zMovePower = 100;
        } else if (basePower >= 140) {
          zMovePower = 200;
        } else if (basePower >= 130) {
          zMovePower = 195;
        } else if (basePower >= 120) {
          zMovePower = 190;
        } else if (basePower >= 110) {
          zMovePower = 185;
        } else if (basePower >= 100) {
          zMovePower = 180;
        } else if (basePower >= 90) {
          zMovePower = 175;
        } else if (basePower >= 80) {
          zMovePower = 160;
        } else if (basePower >= 70) {
          zMovePower = 140;
        } else if (basePower >= 60) {
          zMovePower = 120;
        } else {
          zMovePower = 100;
        }
      }

      zMove = { power: zMovePower };
    }

    // TODO, add to old gen typechart?
    if (moveIn.type === '???') {
      moveIn.type = 'Normal';
    }

    const f = moveIn.flags ?? {};

    const flags = {
      authentic: !!f.authentic,
      bite: !!f.bite,
      bullet: !!f.bullet,
      charge: !!f.charge,
      contact: !!f.contact,
      dance: !!f.dance,
      defrost: !!f.defrost,
      distance: !!f.distance,
      gravity: !!f.gravity,
      heal: !!f.heal,
      mirror: !!f.mirror,
      mystery: !!f.mystery,
      nonsky: !!f.nonsky,
      powder: !!f.powder,
      protect: !!f.protect,
      pulse: !!f.pulse,
      punch: !!f.punch,
      recharge: !!f.recharge,
      reflectable: !!f.reflectable,
      snatch: !!f.snatch,
      sound: !!f.sound,
    };

    let category;
    if (dexIn.num <= 3 && moveIn.category !== 'Status') {
      const specialTypes = [
        'Fire',
        'Water',
        'Grass',
        'Ice',
        'Electric',
        'Dark',
        'Psychic',
        'Dragon',
      ];
      category = specialTypes.includes(moveIn.type) ? 'Special' : 'Physical';
    } else {
      category = moveIn.category;
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
      category,
      zMove,
      isNonstandard: moveIn.isNonstandard ?? null,
      target: capitalize(moveIn.target) as MoveTarget,
      flags,
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
