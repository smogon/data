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
    // Must always be defined for now; decide what to do later
    public species: Transformer<any, any> = new Transformer(
      gen.species !== undefined ? gen.species : [],
      (specie: any) => new Species(this, specie)
    ),
    public abilities: Transformer<any, any> = new Transformer(
      gen.abilities !== undefined ? gen.abilities : [],
      (ability: any) => new Ability(this, ability)
    )
  ) {
    for (const k in gen) {
      switch (k) {
        case 'species':
        case 'abilities':
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
const abilitiesSym = Symbol();

class Species<Ext extends I.ExtSpec> {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
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
        case 'abilities':
          this[abilitiesSym] = specie.abilities;
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

  get abilities() {
    const v = this[abilitiesSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.abilities.get(id));
  }
}

class Ability<Ext extends I.ExtSpec> {
  [k: string]: unknown;

  constructor(public gen: Generation<Ext>, ability: any) {
    for (const k in ability) {
      switch (k) {
        default:
          this[k] = ability[k];
          break;
      }
    }
  }
}
