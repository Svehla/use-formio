const promiseAllObjectValues = async <T extends Record<any, any>>(obj: T) => {
  const entriesObj = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );
  return Object.fromEntries(entriesObj) as { [K in keyof T]: Awaited<T[K]> };
};

const mapObjectValues = <Key extends string, Value, NewValue>(
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

  return Object.fromEntries(entries.map(([key, value]) => [key, fn(value, key)], obj)) as Record<
    Key,
    NewValue
  >;
};

const notNullable = <T>(x: T | null | undefined): x is T => x !== undefined && x !== null;

const getStableObjectValues = (obj: Record<string, any>) => {
  let entries = Object.entries(obj);

  entries = entries.sort(([firstKey], [secondKey]) => {
    if (firstKey < secondKey) {
      return -1;
    } else if (firstKey > secondKey) {
      return 1;
    }
    return 0;
  });

  return entries.map(t => t[1]);
};

export const formioUtils = {
  getStableObjectValues,
  notNullable,
  mapObjectValues,
  promiseAllObjectValues
};
