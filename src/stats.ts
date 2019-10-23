import { GenerationNumber } from './gens';
import { Nature } from './natures';

export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatsTable<T = number> = { [stat in StatName]: T };
export type BoostName = Exclude<StatName, 'hp'> | 'accuracy' | 'evasion';
export type BoostsTable<T = number> = { [boost in BoostName]: T };

const STATS: readonly StatName[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];

const NAMES: Readonly<{ [name: string]: StatName }> = {
  HP: 'hp',
  hp: 'hp',
  Attack: 'atk',
  Atk: 'atk',
  atk: 'atk',
  Defense: 'def',
  Def: 'def',
  def: 'def',
  'Special Attack': 'spa',
  SpA: 'spa',
  SAtk: 'spa',
  SpAtk: 'spa',
  spa: 'spa',
  Special: 'spa',
  spc: 'spa',
  Spc: 'spa',
  'Special Defense': 'spd',
  SpD: 'spd',
  SDef: 'spd',
  SpDef: 'spd',
  spd: 'spd',
  Speed: 'spe',
  Spe: 'spe',
  Spd: 'spe',
  spe: 'spe',
};

const DISPLAY: Readonly<{ [stat: string]: Readonly<[string, string]> }> = {
  hp: ['HP', 'HP'],
  atk: ['Atk', 'Attack'],
  def: ['Def', 'Defense'],
  spa: ['SpA', 'Special Attack'],
  spd: ['SpD', 'Special Defense'],
  spe: ['Spd', 'Speed'],
  spc: ['Spc', 'Special'],
};

export class Stats {
  private constructor() {}

  static calc(
    stat: StatName,
    base: number,
    iv: number,
    ev: number,
    level: number,
    gen?: 1 | 2
  ): number;
  static calc(
    stat: StatName,
    base: number,
    iv: number,
    ev: number,
    level: number,
    nature: Nature,
    gen: GenerationNumber
  ): number;
  static calc(
    stat: StatName,
    base: number,
    iv = 31,
    ev = 252,
    level = 100,
    genOrNature?: GenerationNumber | Nature,
    gen: GenerationNumber = 7
  ): number {
    let nature: Nature | undefined = undefined;
    if (typeof genOrNature === 'number') {
      gen = genOrNature;
    } else {
      nature = genOrNature;
    }

    return gen < 3
      ? calcRBY(stat, base, Stats.itod(iv), ev, level)
      : calcADV(stat, base, iv, ev, level, nature);
  }

  static get(s: string): StatName | undefined {
    return NAMES[s];
  }

  static display(str: string, full = false, gen: GenerationNumber = 7): string {
    let s: StatName | 'spc' | undefined = NAMES[str];
    if (!s) return str;
    if (gen === 1 && s === 'spa') s = 'spc';
    return DISPLAY[s][+full];
  }

  static fill<T>(stats: Partial<StatsTable<T>>, val: T): StatsTable<T> {
    for (const stat of STATS) {
      if (!(stat in stats)) stats[stat] = val;
    }
    return stats as StatsTable<T>;
  }

  static itod(iv: number): number {
    return Math.floor(iv / 2);
  }

  static dtoi(dv: number): number {
    return dv * 2 + 1;
  }

  static getHPDV(ivs: Partial<StatsTable>): number {
    return (
      (Stats.itod(ivs.atk || 31) % 2) * 8 +
      (Stats.itod(ivs.def || 31) % 2) * 4 +
      (Stats.itod(ivs.spe || 31) % 2) * 2 +
      (Stats.itod(ivs.spa || 31) % 2)
    );
  }

  static *[Symbol.iterator](): IterableIterator<StatName> {
    for (const s of STATS) {
      yield s;
    }
  }
}

function calcRBY(stat: StatName, base: number, dv: number, ev: number, level: number) {
  // BUG: we ignore EVs - do we care about converting ev to stat experience?
  if (stat === 'hp') {
    return Math.floor((((base + dv) * 2 + 63) * level) / 100) + level + 10;
  } else {
    return Math.floor((((base + dv) * 2 + 63) * level) / 100) + 5;
  }
}

function calcADV(
  stat: StatName,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature?: Nature
) {
  if (stat === 'hp') {
    return base === 1
      ? base
      : Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  } else {
    let mod = 1;
    if (nature && nature.mod) {
      if (nature.mod.plus === stat) {
        mod = 1.1;
      } else if (nature.mod.minus === stat) {
        mod = 0.9;
      }
    }
    return Math.floor((Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + 5) * mod);
  }
}
