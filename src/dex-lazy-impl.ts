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

  *findAll(fn: (obj: T) => boolean) {
    for (const obj of this) {
      if (fn(obj)) {
        yield obj;
      }
    }
  }
}

class Transformer<Src, Dest> extends StoreBase<Dest> {
  constructor(
    private source: Source<Src>,
    private fn: (id: number, source: Source<Src>) => Dest,
    private cache: Dest[] = []
  ) {
    super();
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

  *[Symbol.iterator]() {
    // TODO: more efficient hole skipping
    let length = 0;
    for (const source of this.source) {
      length = Math.max(length, source.length);
    }

    for (let i = 0; i < length; i++) {
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

type BackrefContainer = {
  [k: string]: {
    [l: string]: [string, string, string?];
  };
};

export default class Dex {
  gens: Transformer<any, Generation>;
  species: GenFamilyStore<Species>;
  abilities: GenFamilyStore<Ability>;
  items: GenFamilyStore<Item>;
  moves: GenFamilyStore<Move>;
  types: GenFamilyStore<Type>;

  private backrefs: BackrefContainer = {};

  constructor(dexSrc: any[]) {
    const genSrc: any[] = [];
    this.gens = new Transformer(
      genSrc,
      (id: number, gen: Source<any>) => new Generation(this, id, gen)
    );
    for (const dex of dexSrc) {
      genSrc.push(dex.gens);
    }
    this.species = new GenFamilyStore(this, 'species');
    this.abilities = new GenFamilyStore(this, 'abilities');
    this.items = new GenFamilyStore(this, 'items');
    this.moves = new GenFamilyStore(this, 'moves');
    this.types = new GenFamilyStore(this, 'types');
  }

  constructBackref(
    [firstOuter, firstInner, firstKey]: [string, string, string?],
    [secondOuter, secondInner, secondKey = firstKey] = [firstInner, firstOuter]
  ): Dex {
    if (!(firstOuter in this.backrefs)) this.backrefs[firstOuter] = {};
    this.backrefs[firstOuter][firstInner] = [secondOuter, secondInner, secondKey];
    if (!(secondOuter in this.backrefs)) this.backrefs[secondOuter] = {};
    this.backrefs[secondOuter][secondInner] = [firstOuter, firstInner, firstKey];
    return this;
  }

  getBackref(outer: string, inner: string): [string, string, string?] | undefined {
    return this.backrefs[outer]?.[inner];
  }
}

////////////////////////////////////////////////////////////////////////////////

class Generation {
  species: Transformer<any, Species>;
  abilities: Transformer<any, Ability>;
  items: Transformer<any, Item>;
  moves: Transformer<any, Move>;
  types: Transformer<any, Type>;
  [k: string]: unknown;

  constructor(public dex: Dex, id: number, genSrc: Source<any>) {
    // Explicitly relying on the ability to mutate this before accessing a
    // transformer element
    const speciesSrc: any[] = [];
    const abilitiesSrc: any[] = [];
    const itemsSrc: any[] = [];
    const movesSrc: any[] = [];
    const typesSrc: any[] = [];

    this.species = new Transformer(
      speciesSrc,
      (id: number, specie: Source<any>) => new Species(this, id, specie)
    );
    this.abilities = new Transformer(
      abilitiesSrc,
      (id: number, ability: Source<any>) => new Ability(this, id, ability)
    );
    this.items = new Transformer(
      itemsSrc,
      (id: number, item: Source<any>) => new Item(this, id, item)
    );
    this.moves = new Transformer(
      movesSrc,
      (id: number, move: Source<any>) => new Move(this, id, move)
    );
    this.types = new Transformer(
      typesSrc,
      (id: number, type: Source<any>) => new Type(this, id, type)
    );

    // Can we abstract this logic into assignRemap?
    for (const delta of genSrc) {
      const gen = delta[id];
      for (const k in gen) {
        switch (k) {
          case 'species':
            speciesSrc.push(gen[k]);
            break;
          case 'abilities':
            abilitiesSrc.push(gen[k]);
            break;
          case 'items':
            itemsSrc.push(gen[k]);
            break;
          case 'moves':
            movesSrc.push(gen[k]);
            break;
          case 'types':
            typesSrc.push(gen[k]);
            break;
          default:
            this[k] = gen[k];
            break;
        }
      }
    }
  }
}

class GenerationalBase {
  [k: string]: unknown;

  constructor(public gen: Generation, public __id: number /* TODO: symbol? */) {}

  protected *resolveBackref<T extends GenerationalBase>(
    outer: string,
    inner: string,
    key?: string
  ): Generator<T, void> | undefined {
    const backref = this.gen.dex.getBackref(outer, inner);
    if (backref === undefined) return undefined;
    const [backrefOuter, backrefInner, backrefKey] = backref;

    const type = this.gen[backrefOuter];
    if (!(type instanceof Transformer)) {
      throw new Error(
        `backref ${outer}.${inner} -> ${backrefOuter}.${backrefInner} does not result in a Transformer`
      );
    }

    const getKeyedObject = (obj: Record<string, any>) =>
      backrefKey === undefined ? obj : obj[backrefKey];
    const result = (type as Transformer<any, T>).findAll(obj => {
      const o = obj[backrefInner] as any;
      if (o === undefined) {
        throw new Error(
          `required key not found for backref ${outer}.${inner} -> ${backrefOuter}.${backrefInner}`
        );
      }

      if (Array.isArray(o)) {
        return o.some(v => (typeof v === 'number' ? v : getKeyedObject(v).__id) === this.__id);
      }

      return (typeof o === 'number' ? o : getKeyedObject(o).__id) === this.__id;
    });

    for (const obj of result) {
      if (key === undefined) {
        yield obj;
        continue;
      }

      const newObj = Object.assign({}, obj) as any;
      newObj[key] = obj;
      yield newObj;
    }
  }

  protected resolveToSymbolOrBackref<T, B extends true = true>(
    sym: symbol,
    refType: string,
    isArray: B,
    key?: string,
    backrefOuter?: string,
    backrefInner?: string
  ): T[];
  protected resolveToSymbolOrBackref<T extends GenerationalBase, B extends false = false>(
    sym: symbol,
    refType: string,
    isArray: B,
    key?: string,
    backrefOuter?: string,
    backrefInner?: string
  ): T | undefined;
  protected resolveToSymbolOrBackref<T extends GenerationalBase>(
    sym: symbol,
    refType: string,
    isArray = true,
    key?: string,
    backrefOuter?: string,
    backrefInner?: string
  ): T | T[] | undefined {
    // TODO: cache backref results and large objects

    // We have to use `this as any` everywhere because TypeScript doesn't like
    // using symbols as indexes.

    const v = (this as any)[sym];

    if (v === undefined) {
      if (backrefOuter !== undefined && backrefInner !== undefined) {
        const backref = this.resolveBackref<T>(backrefOuter, backrefInner, key);
        if (backref !== undefined) {
          if (isArray) return Array.from(backref);
          return backref.next().value as T | undefined;
        }
      }

      throw new Error(`${refType} not loaded yet`);
    }

    const getKeyedValue = (obj: Record<string, any>) => (key === undefined ? obj : obj[key]);
    const getKeyedObject = (obj: Record<string, any>) => {
      const newObj = Object.assign({}, obj) as any;
      newObj[key!] = (this.gen[refType] as Transformer<any, T>).resolve(getKeyedValue(obj));
      return newObj;
    };

    if (isArray && Array.isArray(v)) {
      return v.map(id => {
        if (key === undefined) return (this.gen[refType] as Transformer<any, T>).resolve(id);
        return getKeyedObject(id);
      });
    } else if (!isArray) {
      if (key === undefined) return (this.gen[refType] as Transformer<any, T>).resolve(v);
      return getKeyedObject(v);
    }

    return v;
  }

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

const prevoSym = Symbol();
const evosSym = Symbol();
const abilitiesSym = Symbol();
const typesSym = Symbol();
const learnsetSym = Symbol();
const altBattleFormesSym = Symbol();

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
    const v = this.resolveToSymbolOrBackref<Type>(
      typesSym,
      'types',
      true,
      undefined,
      'species',
      'types'
    );
    return SlashArray.from(v);
  }

  get learnset() {
    return this.resolveToSymbolOrBackref<{ what: Move; how: unknown }>(
      learnsetSym,
      'moves',
      true,
      'what',
      'species',
      'learnset'
    );
  }

  get altBattleFormes() {
    const v = this[altBattleFormesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.species.resolve(id));
  }
}

class Species extends SpeciesBase {
  [k: string]: unknown;

  constructor(gen: Generation, id: number, specie: Source<any>) {
    super(gen, id);
    assignRemap(
      {
        prevo: prevoSym,
        evos: evosSym,
        abilities: abilitiesSym,
        types: typesSym,
        learnset: learnsetSym,
        altBattleFormes: altBattleFormesSym,
      },
      this,
      id,
      specie
    );
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
    assignRemap({}, this, id, ability);
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
    assignRemap({}, this, id, item);
  }
}

////////////////////////////////////////////////////////////////////////////////

const typeSym = Symbol();
const speciesSym = Symbol();

class MoveBase extends GenerationalBase {
  private [typeSym]: number | undefined;
  private [speciesSym]: number[] | undefined;

  get genFamily() {
    return makeGenFamily(this, 'moves');
  }

  get type() {
    return this.resolveToSymbolOrBackref<Type>(typeSym, 'types', false, undefined, 'moves', 'type');
  }

  get species() {
    return this.resolveToSymbolOrBackref<Species>(
      speciesSym,
      'species',
      true,
      'what',
      'moves',
      'species'
    );
  }
}

class Move extends MoveBase {
  [k: string]: unknown;

  constructor(gen: Generation, id: number, move: Source<any>) {
    super(gen, id);
    assignRemap({ type: typeSym }, this, id, move);
  }
}

////////////////////////////////////////////////////////////////////////////////

const movesSym = Symbol();

class Type extends GenerationalBase {
  [speciesSym]: number[] | undefined;
  [movesSym]: number[] | undefined;
  [k: string]: unknown;

  get genFamily() {
    return makeGenFamily(this, 'types');
  }

  get species() {
    return this.resolveToSymbolOrBackref(
      speciesSym,
      'species',
      true,
      undefined,
      'types',
      'species'
    );
  }

  get moves() {
    return this.resolveToSymbolOrBackref(movesSym, 'moves', true, undefined, 'types', 'moves');
  }

  constructor(gen: Generation, id: number, type: Source<any>) {
    super(gen, id);
    assignRemap({}, this, id, type);
  }
}
