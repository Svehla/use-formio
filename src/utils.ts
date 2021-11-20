export type Await<T> = T extends Promise<infer U> ? U : T;

export const promiseAllObjectValues = async <T>(obj: T) => {
  const entriesObj = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );
  return Object.fromEntries(entriesObj) as { [K in keyof T]: Await<T[K]> };
};

export const mapObjectValues = <Key extends string, Value, NewValue>(
  fn: (value: Value, key: Key) => NewValue,
  obj: Record<Key, Value>,
  { stableKeyOrder = false } = {}
) => {
  let entries = Object.entries(obj) as [Key, Value][];

  if (stableKeyOrder) {
    entries = entries.sort(([firstKey], [secondKey]) => {
      if (firstKey < secondKey) {
        return -1;
      } else if (firstKey > secondKey) {
        return 1;
      }
      return 0;
    });
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, fn(value, key)], obj)
  ) as Record<Key, NewValue>;
};

export const notNullable = <T>(x: T | null | undefined): x is T =>
  x !== undefined && x !== null;
