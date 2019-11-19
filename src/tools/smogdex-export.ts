// This file is a huge hack intended to ease the transition between the Smogdex and new dex.

import {
  Dex,
  Item,
  Ability,
  Species,
  Move,
  Generation,
  GenFamily,
  GenerationNumber,
} from '../index';
import { StatsTable } from '../stats';
import { PSExt } from '../ps-import';

const genInheritance = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss'];

function getIntroduction(genFamily: GenFamily<{ gen: { num: number } }>) {
  const introduction = [];
  for (const obj of genFamily) {
    introduction.push(genInheritance[obj.gen.num - 1]);
  }
  return introduction;
}

// Need to use latest names, not gen-accurate names
function getName(obj: any) {
  let name = obj.genFamily.latest.name;
  if (name === 'Necrozma-Dawn-Wings') {
    name = 'Necrozma-Dawn Wings';
  } else if (name === 'Necrozma-Dusk-Mane') {
    name = 'Necrozma-Dusk Mane';
  } else if (name === 'Flabébé') {
    name = 'Flabebe';
  } else if (name === 'Meowstic') {
    name = 'Meowstic-M';
  }
  return name;
}

const TRANSFORMS = {
  items(item: Item<'Rich', PSExt>) {
    return {
      description: item.desc,
      shortdescription: item.shortDesc,
      cap: item.isNonstandard === 'CAP',
    };
  },

  abilities(ability: Ability<'Rich', PSExt>) {
    return {
      description: ability.desc,
      shortdescription: ability.shortDesc,
      cap: ability.isNonstandard === 'CAP',
    };
  },

  species(specie: Species<'Rich', PSExt>) {
    const tags = [];
    if (specie.tier === '(PU)') {
      if (specie.gen.num >= 7) {
        tags.push('Untiered');
      } else {
        tags.push('PU');
      }
    } else if (specie.tier === '(OU)') {
      tags.push('OU');
    } else if (['Unreleased', 'New'].includes(specie.tier)) {
      tags.push('Limbo');
    } else if (['CAP NFE', 'CAP Uber', 'LC Uber', 'Illegal', 'CAP LC'].includes(specie.tier)) {
    } else if (specie.tier !== 'NFE') {
      tags.push(specie.tier);
    }

    const specieOut = {
      abilities: specie.abilities.map(getName),
      stats: [
        specie.baseStats.hp,
        specie.baseStats.atk,
        specie.baseStats.def,
        specie.baseStats.spa,
        specie.baseStats.spd,
        specie.baseStats.spe,
      ],
      types: specie.types.map(getName),

      height: specie.heightm,
      weight: specie.weightkg,
      tags,
    } as any;

    if (specie.isBattleOnly) {
      specieOut.pokemon = specie.altBattleFormes.map(getName);
    } else {
      specieOut.dexNumber = specie.num;
      specieOut.cap = specie.isNonstandard === 'CAP';
      specieOut.egggroups = [];
      specieOut.evolvesFrom = specie.prevo === null ? null : getName(specie.prevo);
    }
    return specieOut;
  },

  moves(move: Move<'Rich', PSExt>) {
    let desc = move.desc;
    if (move.zMove !== null) {
      desc += ` Z-Move Base Power: ${move.zMove.power}`;
    }
    return {
      accuracy: move.accuracy === 'Bypass' ? 0 : move.accuracy,
      power: move.basePower,
      type: getName(move.type),
      pp: move.pp,
      priority: move.priority,
      category: move.category === 'Status' ? 'Non-Damaging' : move.category,
      description: desc,
      shortdescription: move.shortDesc,
      cap: move.isNonstandard === 'CAP',
      target: move.target,
      // Flags
    };
  },
};

function makeGenDiff(x: Array<{ gen: string; data: Record<string, unknown> }>) {
  const keys = Object.keys(x[0].data);
  const gendiff = { introduction: [] } as any;
  for (const v of x) {
    gendiff.introduction.push(v.gen);
  }
  for (const key of keys) {
    const record = {} as any;
    gendiff[key] = [record];
    for (const v of x) {
      record[v.gen] = v.data[key];
    }
  }
  return gendiff;
}

function exportGF(gfs: Iterable<GenFamily<any>>, k: string) {
  const idk = Object.create(null);
  for (const gf of gfs) {
    const result = [];
    for (const obj of gf) {
      result.push({ gen: genInheritance[obj.gen.num - 1], data: (TRANSFORMS as any)[k](obj) });
    }
    idk[getName(gf.latest)] = makeGenDiff(result);
  }
  return idk;
}

function exportLearnsets(gen: Generation<'Rich', PSExt>) {
  const learnsets = Object.create(null);

  for (const specie of gen.species) {
    if (specie.isBattleOnly) continue;
    learnsets[getName(specie)] = {
      moves: specie.learnset.map(getName).filter(x => x !== 'Hidden Power'),
    };
  }

  return {
    learnsets: {
      [genInheritance[gen.num - 1]]: learnsets,
    },
  };
}

////////////////////////////////////////////////////////////////////////////////

import path from 'path';
import fs from 'fs';
import psImport from '../ps-import';
import { loader } from '../index';
import yaml from 'js-yaml';

const [, , psDataDir, exportDir] = process.argv;

if (psDataDir === undefined || exportDir === undefined) {
  console.error('smogdex-export <ps data dir> <export dir>');
  process.exit(1);
}

const data = psImport(psDataDir);
const dex = loader.load(data).construct();

fs.mkdirSync(exportDir, { recursive: true });

function writeYaml(filename: string, obj: any) {
  fs.writeFileSync(path.join(exportDir, filename), yaml.safeDump(obj));
}

// Assume species never change battle only
const species = Array.from(dex.species).filter(x => !x.latest.isBattleOnly);
const alts = Array.from(dex.species).filter(x => x.latest.isBattleOnly);

writeYaml(`species.yaml`, {
  genInheritance,
  pokemon: exportGF(species, 'species'),
  pokemonalts: exportGF(alts, 'species'),
});

writeYaml('items.yaml', {
  genInheritance,
  items: {
    'No Item': {
      introduction: 'gs',
      description: ['Placeholder used in movesets that do not use an item.'],
    },
    ...exportGF(dex.items, 'items'),
  },
});

const moves = Array.from(dex.moves).filter(x => x.latest.name !== 'Hidden Power');

writeYaml('moves.yaml', {
  genInheritance,
  moves: exportGF(moves, 'moves'),
});

writeYaml('abilities.yaml', {
  genInheritance,
  abilities: exportGF(dex.abilities, 'abilities'),
});

for (const gen of dex.gens) {
  writeYaml(`learnset-${gen.num}.yaml`, exportLearnsets(gen));
}
