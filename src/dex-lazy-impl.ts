import * as I from './dex-interfaces';

class Transformer<Src, Dest> implements I.Store<Dest> {
  constructor(
    private source: Src[],
    private fn: (dv: Src) => Dest,
    private cache = new Array(source.length)
  ) {}

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    const dv = this.source[id];
    if (dv === undefined) {
      return undefined;
    }

    v = this.fn(dv);
    this.cache[id] = v;
    return v;
  }

  resolve(id: number): Dest {
    const v = this.get(id);
    if (v === undefined) {
      throw new Error('Cannot resolve');
    }
    return v;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.source.length; i++) {
      let v = this.cache[i];
      if (v === undefined) {
        const dv = this.source[i];
        v = this.fn(dv);
        this.cache[i] = v;
      }
      yield v;
    }
  }
}

export default class Dex implements I.Dex<'Rich'> {
  constructor(
    _source: I.Dex<'Plain'>,
    public gens = new Transformer(_source.gens, (gen: I.Generation<'Plain'>) => new Generation(gen))
  ) {}
}

class Generation implements I.Generation<'Rich'> {
  constructor(
    _source: I.Generation<'Plain'>,
    public num = _source.num,
    public species = new Transformer(
      _source.species,
      (specie: I.Species<'Plain'>) => new Species(this, specie)
    )
  ) {}
}

class Species implements I.Species<'Rich'> {
  constructor(
    public gen: Generation,
    specie: I.Species<'Plain'>,
    public name = specie.name,
    private _prevo = specie.prevo,
    private _evos = specie.evos
  ) {}

  get prevo() {
    if (this._prevo === null) return null;
    return this.gen.species.resolve(this._prevo);
  }

  get evos() {
    return this._evos.map(id => this.gen.species.resolve(id));
  }
}
