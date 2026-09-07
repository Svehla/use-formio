/**
 * The pure internals. These run on every render (`mapObjectValues` builds the whole `fields`
 * object) so their per-key cost is multiplied by every keystroke in a form.
 *
 * `stableKeyOrder: true` is what `useFormio` uses for the fields map — the on/off pair shows the
 * price of the sort that happens on *every* render.
 */
import { bench, describe } from "vitest";
import { makeInitState } from "./benchUtils";
import { formioUtils } from "../src/utils";

const { getStableObjectValues, mapObjectValues, promiseAllObjectValues } = formioUtils;

const SIZES = [10, 100, 1000] as const;
const identity = (value: string) => value;

describe("utils.mapObjectValues", () => {
  for (const size of SIZES) {
    const obj = makeInitState(size);

    bench(`mapObjectValues ${size} keys (stableKeyOrder: false)`, () => {
      mapObjectValues(identity, obj);
    });

    bench(`mapObjectValues ${size} keys (stableKeyOrder: true)`, () => {
      mapObjectValues(identity, obj, { stableKeyOrder: true });
    });
  }
});

describe("utils.getStableObjectValues", () => {
  const obj = makeInitState(1000);
  bench("getStableObjectValues 1000 keys", () => {
    getStableObjectValues(obj);
  });
});

describe("utils.promiseAllObjectValues", () => {
  const plain = makeInitState(1000);
  bench("promiseAllObjectValues 1000 plain values", async () => {
    await promiseAllObjectValues(plain);
  });

  const promised = mapObjectValues(value => Promise.resolve(value), plain);
  bench("promiseAllObjectValues 1000 resolved promises", async () => {
    await promiseAllObjectValues(promised);
  });
});
