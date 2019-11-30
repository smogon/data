export { ID, toID } from './common';
export { NatureName, Nature, Natures } from './natures';
export { GenerationNumber } from './gens';
export { Stats, StatName, StatsTable, BoostName, BoostsTable } from './stats';

export * from './dex-interfaces';
import * as I from './dex-interfaces';
import { Dex } from './dex-lazy-impl';

class Loader<Ext extends I.ExtSpec> {
  constructor(private sources: any[]) {}
  construct(): I.Dex<'Rich', Ext> {
    return (new Dex(this.sources) as unknown) as I.Dex<'Rich', Ext>;
  }
  load<NewExt extends I.ExtSpec>(source: I.Dex<'Plain', NewExt>): Loader<Ext & NewExt> {
    return new Loader([source, ...this.sources]);
  }
}

export const loader: Loader<{}> = new Loader([]);
