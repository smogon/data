export type ID = '' | string & { __isID: true };
export function toID(s: string): ID {
  return ('' + s).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

export type DeepReadonly<T> = T extends primitive ? T : DeepReadonlyObject<T>;
type primitive = string | number | boolean | undefined | null | Function | ID;
type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type Nullable<T> = T extends primitive ? T : NullableObject<T>;
type NullableObject<T> = {
  -readonly [P in keyof T]: Nullable<T[P]> | null;
};
