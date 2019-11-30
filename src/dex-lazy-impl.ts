// If all sources for an id are null, then it isn't a member of this
// generation. If one source has null and another has a record, then the null
// contributes nothing.
//
// TODO: allow an object ("sparse") representation
//
// TODO: support generational deltas, but need a mask of which objects are in
// the generation
type Delta<T> = Array<T | null>;
type Source<T> = Array<Delta<T>>;

// TODO: maybe move to its own file, if we add more advanced search?
abstract class StoreBase<T> {
  abstract [Symbol.iterator](): Iterator<T>;

  find(fn: (obj: T) => boolean) {
    for (const obj of this) {
      if (fn(obj)) {
        return obj;
      }
    }
    return undefined;
  }

  find1(fn: (obj: T) => boolean) {
    const v = this.find(fn);
    if (v === undefined) {
      throw new Error('Nothing found');
    }
    return v;
  }

  *filter(fn: (obj: T) => boolean) {
    for (const obj of this) {
      if (fn(obj)) {
        yield obj;
      }
    }
  }
}

export class Transformer<Src, Dest> extends StoreBase<Dest> {
  private sourceInnerLength = 0;

  constructor(
    private source: Source<Src>,
    private fn: (id: number, source: Source<Src>) => Dest,
    private cache: Dest[] = []
  ) {
    super();

    for (const src of source) {
      this.sourceInnerLength = Math.max(this.sourceInnerLength, src.length);
    }

    // Add internal-use source
    source.unshift([]);
    for (let i = 0; i < this.sourceInnerLength; i++) source[0].push({} as any);
  }

  addSource(source: Delta<Src>) {
    this.source.push(source);
    this.sourceInnerLength = Math.max(this.sourceInnerLength, source.length);

    // Resize internal-use source if necessary
    // TODO: make this more performant
    for (let i = 0; i < this.sourceInnerLength; i++) {
      const hasNonNull = this.source.some(src => {
        const el = src[i];
        return el !== undefined && el !== null;
      });

      if (hasNonNull) {
        if (this.source[0][i] === undefined || this.source[0][i] === null) {
          this.source[0][i] = {} as any;
        }
      } else {
        this.source[0][i] = null;
      }
    }
  }

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    // TODO: lift into this.fn
    let found = false;
    for (const src of this.source) {
      const x = src[id];
      if (!(x === undefined || x === null)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return undefined;
    }

    v = this.fn(id, this.source);

    // TODO: not possible atm
    if (v === undefined) {
      return undefined;
    }

    this.cache[id] = v;
    return v;
  }

  resolve(id: number) {
    const v = this.get(id);
    if (v === undefined) throw new Error(`Cannot resolve ${id}`);
    return v;
  }

  getSource(id: number) {
    return this.source.map(src => src[id]);
  }

  *sourcesById(): Generator<[Array<Src | null>, number]> {
    for (let i = 0; i < this.sourceInnerLength; i++) {
      yield [this.getSource(i), i];
    }
  }

  mapSource(
    srcFn: (delta: Array<Src | null>, id: number) => void,
    transformFn: (obj: Dest, id: number) => void
  ) {
    for (let i = 0; i < this.sourceInnerLength; i++) {
      const sources = this.source.map(src => src[i]);
      srcFn(sources, i);
      sources.forEach((src, j) => {
        if (this.source[j] === undefined) this.source[j] = [];
        this.source[j][i] = src;
      });

      if (this.cache[i] !== undefined) {
        transformFn(this.cache[i], i);
      }
    }
  }

  *[Symbol.iterator]() {
    // TODO: more efficient hole skipping
    for (let i = 0; i < this.sourceInnerLength; i++) {
      const v = this.get(i);
      if (v === undefined) continue;
      yield v;
    }
  }
}

class GenFamilyStore<T> extends StoreBase<GenFamily<T>> {
  constructor(private dex: Dex, private k: string) {
    super();
  }

  *[Symbol.iterator]() {
    const transformers = [] as Array<Transformer<any, T>>;
    for (const gen of this.dex.gens) {
      // TODO data kind
      transformers.push(gen[this.k] as Transformer<any, T>);
    }
    let i = 0;
    while (true) {
      const objs = [];
      for (const transformer of transformers) {
        // TODO: make genfamily lazy, so we don't construct the object of every
        // gen as we iterate (for example, if we only needed the latest)?
        const obj = transformer.get(i);
        if (obj !== undefined) {
          objs.push(obj);
        }
      }
      if (objs.length === 0) {
        break;
      }
      yield new GenFamily(objs);
      i++;
    }
  }
}

function assignRemap(
  remap: Record<string, symbol>,
  dest: any,
  id: number,
  srcs: Source<Record<string, unknown>>
) {
  // TODO need a better naming scheme for sources/deltas...
  for (const delta of srcs) {
    const src = delta[id];
    // src can be null, reminder that for-in on null is a no-op
    for (const k in src) {
      if (k in remap) {
        dest[remap[k]] = src[k];
      } else {
        dest[k] = src[k];
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

export class Dex {
  gens: Transformer<any, Generation>;
  species: GenFamilyStore<Species>;
  abilities: GenFamilyStore<Ability>;
  items: GenFamilyStore<Item>;
  moves: GenFamilyStore<Move>;
  types: GenFamilyStore<Type>;

  constructor(dexSrc: any[]) {
    this.gens = new Transformer(
      [],
      (id: number, gen: Source<any>) => new Generation(this, id, gen)
    );
    for (const dex of dexSrc) {
      this.gens.addSource(dex.gens);
    }
    this.species = new GenFamilyStore(this, 'species');
    this.abilities = new GenFamilyStore(this, 'abilities');
    this.items = new GenFamilyStore(this, 'items');
    this.moves = new GenFamilyStore(this, 'moves');
    this.types = new GenFamilyStore(this, 'types');
  }
}

////////////////////////////////////////////////////////////////////////////////

export class Generation {
  species: Transformer<any, Species>;
  abilities: Transformer<any, Ability>;
  items: Transformer<any, Item>;
  moves: Transformer<any, Move>;
  types: Transformer<any, Type>;
  [k: string]: unknown;

  constructor(public dex: Dex, id: number, genSrc: Source<any>) {
    this.species = new Transformer(
      [],
      (id: number, specie: Source<any>) => new Species(this, id, specie)
    );
    this.abilities = new Transformer(
      [],
      (id: number, ability: Source<any>) => new Ability(this, id, ability)
    );
    this.items = new Transformer([], (id: number, item: Source<any>) => new Item(this, id, item));
    this.moves = new Transformer([], (id: number, move: Source<any>) => new Move(this, id, move));
    this.types = new Transformer([], (id: number, type: Source<any>) => new Type(this, id, type));

    // Can we abstract this logic into assignRemap?
    for (const delta of genSrc) {
      const gen = delta[id];
      for (const k in gen) {
        switch (k) {
          case 'species':
            this.species.addSource(gen[k]);
            break;
          case 'abilities':
            this.abilities.addSource(gen[k]);
            break;
          case 'items':
            this.items.addSource(gen[k]);
            break;
          case 'moves':
            this.moves.addSource(gen[k]);
            break;
          case 'types':
            this.types.addSource(gen[k]);
            break;
          default:
            this[k] = gen[k];
            break;
        }
      }
    }
  }
}

export class GenerationalBase {
  static REMAP: { [key: string]: symbol } = {};
  [k: string]: unknown;

  constructor(public gen: Generation, public __id: number /* TODO: symbol? */) {}

  toString() {
    if (Object.getOwnPropertyDescriptor(this, 'name') !== undefined) {
      return (this as any).name;
    } else {
      return 'Unknown game object';
    }
  }
}

// TODO move to a different file?
class SlashArray extends Array {
  toString() {
    return this.join('/').toString();
  }
}

class GenFamily<T> extends StoreBase<T> {
  constructor(private arr: T[]) {
    super();
  }

  [Symbol.iterator]() {
    return this.arr[Symbol.iterator]();
  }

  get earliest() {
    return this.arr[0];
  }

  get latest() {
    return this.arr[this.arr.length - 1];
  }
}

// TODO is there any way we can cache this? also its just kind of ugly, and
// maybe should exist on GenerationalBase if we add a datakind attribute
function makeGenFamily(go: GenerationalBase, k: string) {
  const arr = [];
  for (const gen of go.gen.dex.gens) {
    // TODO: datakind?
    const obj = (gen[k] as any).get(go.__id);
    if (obj !== undefined) arr.push(obj);
  }
  return new GenFamily(arr);
}

////////////////////////////////////////////////////////////////////////////////

const prevoSym = Symbol('prevo');
const evosSym = Symbol('evos');
const abilitiesSym = Symbol('abilities');
const typesSym = Symbol('types');
const learnsetSym = Symbol('learnset');
const altBattleFormesSym = Symbol('altBattleFormes');

class SpeciesBase extends GenerationalBase {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
  private [typesSym]: number[] | undefined;
  // TODO: thread MoveSource here to this `unknown`
  private [learnsetSym]: Array<{ what: number; how: unknown }> | undefined;
  private [altBattleFormesSym]: number[] | undefined;

  get genFamily() {
    return makeGenFamily(this, 'species');
  }

  get prevo() {
    const v = this[prevoSym];
    if (v === undefined) throw new Error('prevo not loaded yet');
    if (v === null) return null;
    return this.gen.species.resolve(v);
  }

  get evos() {
    const v = this[evosSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.species.resolve(id));
  }

  get abilities() {
    const v = this[abilitiesSym];
    if (v === undefined) throw new Error('abilities not loaded yet');
    return v.map(id => this.gen.abilities.resolve(id));
  }

  get types() {
    const v = this[typesSym];
    if (v === undefined) throw new Error('types not loaded yet');
    const typeArray = new SlashArray();
    for (const id of v) {
      typeArray.push(this.gen.types.resolve(id));
    }
    return typeArray;
  }

  get learnset() {
    const v = this[learnsetSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    // TODO: cache this? make it a Transformer? this is a big attribute
    return v.map(({ what: id, how }) => ({ what: this.gen.moves.resolve(id), how }));
  }

  get altBattleFormes() {
    const v = this[altBattleFormesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.species.resolve(id));
  }
}

class Species extends SpeciesBase {
  static REMAP = {
    prevo: prevoSym,
    evos: evosSym,
    abilities: abilitiesSym,
    types: typesSym,
    learnset: learnsetSym,
    altBattleFormes: altBattleFormesSym,
  };
  [k: string]: unknown;

  constructor(gen: Generation, id: number, specie: Source<any>) {
    super(gen, id);
    assignRemap((this.constructor as typeof Species).REMAP, this, id, specie);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Ability extends GenerationalBase {
  [k: string]: unknown;

  get genFamily() {
    return makeGenFamily(this, 'abilities');
  }

  constructor(gen: Generation, id: number, ability: Source<any>) {
    super(gen, id);
    assignRemap((this.constructor as typeof Ability).REMAP, this, id, ability);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Item extends GenerationalBase {
  [k: string]: unknown;

  get genFamily() {
    return makeGenFamily(this, 'items');
  }

  constructor(gen: Generation, id: number, item: Source<any>) {
    super(gen, id);
    assignRemap((this.constructor as typeof Item).REMAP, this, id, item);
  }
}

////////////////////////////////////////////////////////////////////////////////

const typeSym = Symbol('type');
const speciesSym = Symbol('species');

class MoveBase extends GenerationalBase {
  private [typeSym]: number | undefined;
  private [speciesSym]: Array<{ what: number; how: unknown }> | undefined;

  get genFamily() {
    return makeGenFamily(this, 'moves');
  }

  get type() {
    const v = this[typeSym];
    if (v === undefined) throw new Error('type not loaded yet');
    return this.gen.types.resolve(v);
  }

  get species() {
    const v = this[speciesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    // TODO: cache this? make it a Transformer? this is a big attribute
    return v.map(({ what: id, how }) => ({ what: this.gen.species.resolve(id), how }));
  }
}

class Move extends MoveBase {
  static REMAP = {
    type: typeSym,
    species: speciesSym,
  };
  [k: string]: unknown;

  constructor(gen: Generation, id: number, move: Source<any>) {
    super(gen, id);
    assignRemap((this.constructor as typeof Move).REMAP, this, id, move);
  }
}

////////////////////////////////////////////////////////////////////////////////

const movesSym = Symbol('moves');

class Type extends GenerationalBase {
  static REMAP = {
    species: speciesSym,
    moves: movesSym,
  };
  [speciesSym]: number[] | undefined;
  [movesSym]: number[] | undefined;
  [k: string]: unknown;

  get genFamily() {
    return makeGenFamily(this, 'types');
  }

  get species() {
    const v = this[speciesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    // TODO: cache this? make it a Transformer? this is a big attribute
    return v.map(id => this.gen.species.resolve(id));
  }

  get moves() {
    const v = this[movesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    // TODO: cache this? make it a Transformer? this is a big attribute
    return v.map(id => this.gen.moves.resolve(id));
  }

  constructor(gen: Generation, id: number, type: Source<any>) {
    super(gen, id);
    assignRemap((this.constructor as typeof Type).REMAP, this, id, type);
  }
}
