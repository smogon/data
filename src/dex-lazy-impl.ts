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
    ),
    public items: Transformer<any, any> = new Transformer(
      gen.items !== undefined ? gen.items : [],
      (item: any) => new Item(this, item)
    ),
    public moves: Transformer<any, any> = new Transformer(
      gen.moves !== undefined ? gen.moves : [],
      (move: any) => new Move(this, move)
    ),
    public types: Transformer<any, any> = new Transformer(
      gen.types !== undefined ? gen.types : [],
      (type: any) => new Type(this, type)
    )
  ) {
    for (const k in gen) {
      switch (k) {
        case 'species':
        case 'abilities':
        case 'items':
        case 'moves':
        case 'types':
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
const typesSym = Symbol();

class Species<Ext extends I.ExtSpec> {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
  private [typesSym]: number[] | undefined;
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
        case 'types':
          this[typesSym] = specie.types;
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
    if (v === undefined) throw new Error('abilities not loaded yet');
    return v.map(id => this.gen.abilities.get(id));
  }

  get types() {
    const v = this[typesSym];
    if (v === undefined) throw new Error('types not loaded yet');
    return v.map(id => this.gen.types.get(id));
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

class Item<Ext extends I.ExtSpec> {
  [k: string]: unknown;

  constructor(public gen: Generation<Ext>, item: any) {
    for (const k in item) {
      switch (k) {
        default:
          this[k] = item[k];
          break;
      }
    }
  }
}

class Move<Ext extends I.ExtSpec> {
  [k: string]: unknown;

  constructor(public gen: Generation<Ext>, move: any) {
    for (const k in move) {
      switch (k) {
        default:
          this[k] = move[k];
          break;
      }
    }
  }
}

class Type<Ext extends I.ExtSpec> {
  [k: string]: unknown;

  constructor(public gen: Generation<Ext>, type: any) {
    for (const k in type) {
      switch (k) {
        default:
          this[k] = type[k];
          break;
      }
    }
  }
}
