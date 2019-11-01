import * as I from './dex-interfaces';

class Transformer<Src, Dest> implements I.Store<Dest> {
  constructor(
    private source: Src[],
    private fn: (dv: Src) => Dest,
    private cache: Dest[] = new Array(source.length)
  ) {}

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    const dv = this.source[id];
    if (dv === undefined) {
      throw new Error(`Cannot resolve ${id}`);
    }

    v = this.fn(dv);
    this.cache[id] = v;
    return v;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.source.length; i++) {
      yield this.get(i);
    }
  }
}

export default class Dex<Ext extends I.ExtSpec> {
  constructor(
    dex: I.Dex<'Plain', Ext>,
    public gens = new Transformer(
      dex.gens,
      (gen: I.Generation<'Plain', Ext>) => new Generation(gen)
    )
  ) {}
}

class Generation<Ext extends I.ExtSpec> {
  [k: string]: unknown;

  constructor(
    gen: any,
    public species: Transformer<I.Species<'Plain', Ext>, Species<Ext>> = new Transformer(
      gen.species,
      (specie: I.Species<'Plain', Ext>) => new Species(this, specie)
    )
  ) {
    for (const k in gen) {
      switch (k) {
        case 'species':
          break;
        default:
          this[k] = gen[k];
          break;
      }
    }
  }
}

const prevoSym = Symbol();
const evosSym = Symbol();

class Species<Ext extends I.ExtSpec> {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  [k: string]: unknown;

  constructor(public gen: Generation<Ext>, specie: any) {
    for (const k in specie) {
      switch (k) {
        case 'prevo':
          this[prevoSym] = specie.prevo;
          break;
        case 'evos':
          this[evosSym] = specie.evos;
          break;
        default:
          this[k] = specie[k];
          break;
      }
    }
  }

  get prevo() {
    const v = this[prevoSym];
    if (v === undefined) throw new Error('prevo not loaded yet');
    if (v === null) return null;
    return this.gen.species.get(v);
  }

  get evos() {
    const v = this[evosSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.species.get(id));
  }
}
