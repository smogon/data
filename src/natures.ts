import { ID, toID, DeepReadonly, Nullable } from './common';
import { StatName } from './stats';

export type NatureName =
  | 'Adamant'
  | 'Bashful'
  | 'Bold'
  | 'Brave'
  | 'Calm'
  | 'Careful'
  | 'Docile'
  | 'Gentle'
  | 'Hardy'
  | 'Hasty'
  | 'Impish'
  | 'Jolly'
  | 'Lax'
  | 'Lonely'
  | 'Mild'
  | 'Modest'
  | 'Naive'
  | 'Naughty'
  | 'Quiet'
  | 'Quirky'
  | 'Rash'
  | 'Relaxed'
  | 'Sassy'
  | 'Serious'
  | 'Timid';

export interface Nature
  extends DeepReadonly<{
    id: ID;
    name: NatureName;
    mod: {
      plus: StatName;
      minus: StatName;
    } | null;
  }> {}

class NatureImpl implements Nature {
  readonly id: ID;
  constructor(readonly name: NatureName, readonly mod: { plus: StatName; minus: StatName } | null) {
    this.id = toID(name);
    this.name = name;
    this.mod = mod;
  }

  toString(): string {
    return this.name;
  }

  toJSON() {
    return { name: this.name, mod: this.mod === null ? undefined : this.mod };
  }
}

const NATURES: Readonly<{ [id: string]: Nature }> = {
  adamant: new NatureImpl('Adamant', { plus: 'atk', minus: 'spa' }),
  bashful: new NatureImpl('Bashful', null),
  bold: new NatureImpl('Bold', { plus: 'def', minus: 'atk' }),
  brave: new NatureImpl('Brave', { plus: 'atk', minus: 'spe' }),
  calm: new NatureImpl('Calm', { plus: 'spd', minus: 'atk' }),
  careful: new NatureImpl('Careful', { plus: 'spd', minus: 'spa' }),
  docile: new NatureImpl('Docile', null),
  gentle: new NatureImpl('Gentle', { plus: 'spd', minus: 'def' }),
  hardy: new NatureImpl('Hardy', null),
  hasty: new NatureImpl('Hasty', { plus: 'spe', minus: 'def' }),
  impish: new NatureImpl('Impish', { plus: 'def', minus: 'spa' }),
  jolly: new NatureImpl('Jolly', { plus: 'spe', minus: 'spa' }),
  lax: new NatureImpl('Lax', { plus: 'def', minus: 'spd' }),
  lonely: new NatureImpl('Lonely', { plus: 'atk', minus: 'def' }),
  mild: new NatureImpl('Mild', { plus: 'spa', minus: 'def' }),
  modest: new NatureImpl('Modest', { plus: 'spa', minus: 'atk' }),
  naive: new NatureImpl('Naive', { plus: 'spe', minus: 'spd' }),
  naughty: new NatureImpl('Naughty', { plus: 'atk', minus: 'spd' }),
  quiet: new NatureImpl('Quiet', { plus: 'spa', minus: 'spe' }),
  quirky: new NatureImpl('Quirky', null),
  rash: new NatureImpl('Rash', { plus: 'spa', minus: 'spd' }),
  relaxed: new NatureImpl('Relaxed', { plus: 'def', minus: 'spe' }),
  sassy: new NatureImpl('Sassy', { plus: 'spd', minus: 'spe' }),
  serious: new NatureImpl('Serious', null),
  timid: new NatureImpl('Timid', { plus: 'spe', minus: 'atk' }),
};

export const Natures = new (class {
  get(id: ID): Nature | undefined {
    return NATURES[id];
  }

  *[Symbol.iterator](): IterableIterator<Nature> {
    for (const id in NATURES) {
      yield NATURES[id];
    }
  }
})();
