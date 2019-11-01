export { ID, toID } from './common';
export { NatureName, Nature, Natures } from './natures';
export { GenerationNumber } from './gens';
export { Stats, StatName, StatsTable, BoostName, BoostsTable } from './stats';

export * from './dex-interfaces';
import * as I from './dex-interfaces';
import Dex from './dex-lazy-impl';

export function load<Ext extends I.ExtSpec>(source: I.Dex<'Plain', Ext>): I.Dex<'Rich', Ext> {
  return (new Dex(source) as unknown) as I.Dex<'Rich', Ext>;
}
