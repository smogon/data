// Comment copied from dex-lazy-impl pre-refactor:

// If all sources for an id are null, then it isn't a member of this
// generation. If one source has null and another has a record, then the null
// contributes nothing.
//
// TODO: allow an object ("sparse") representation
//
// TODO: support generational deltas, but need a mask of which objects are in
// the generation

export interface Source {
  // The tighter the approximation the better.
  start: number;
  end: number;
  // Undefined behavior if entry does not exist.
  assign(dest: object, index: number): void;
  exists(index: number): boolean;
}

export class PrimSource implements Source {
  pairs: Array<{ from: string; to: string | symbol }>;
  start: number;
  end: number;

  constructor(private data: Array<object | null>, private remap: Map<string, string | symbol>) {
    this.pairs = [];
    this.start = data.length;
    this.end = data.length;

    for (let i = 0; i < data.length; i++) {
      const obj = data[i];
      if (obj === null) {
        continue;
      }

      this.start = i;

      for (const from of Object.keys(obj)) {
        const to = remap.get(from) ?? from;
        this.pairs.push({ from, to });
      }

      break;
    }
  }

  private get(index: number): object | null {
    if (index >= this.data.length) {
      return null;
    }

    return this.data[index];
  }

  exists(index: number) {
    const obj = this.get(index);
    if (obj === null) {
      return false;
    }
    return true;
  }

  assign(dest: any, index: number) {
    const obj = this.get(index);
    if (obj === null) {
      return;
    }

    for (const { from, to } of this.pairs) {
      dest[to] = (obj as any)[from];
    }
  }
}

export class MultiSource implements Source {
  start: number;
  end: number;
  sources: Source[];

  constructor() {
    this.start = 1073741823; // 2**30-1, guaranteed to be an Smi in V8
    this.end = 0;
    this.sources = [];
  }

  add(source: Source) {
    this.start = Math.min(this.start, source.start);
    this.end = Math.max(this.end, source.end);
    this.sources.push(source);
  }

  assign(dest: object, index: number) {
    for (const source of this.sources) {
      source.assign(dest, index);
    }
  }

  exists(index: number) {
    for (const source of this.sources) {
      if (source.exists(index)) {
        return true;
      }
    }
    return false;
  }
}
