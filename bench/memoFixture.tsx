/**
 * A form of `React.memo`'d inputs plus a render counter.
 *
 * This is the fixture behind both the memoization benchmark (`memo.bench.tsx`) and the
 * memoization *regression test* (`renderCount.test.tsx`). Counting how many memoized children
 * re-render when a single field changes is the cheapest possible proxy for "does `useFormio`
 * hand out stable field objects" — and stable field objects are the whole reason a 1000-field
 * form stays usable.
 */
import { fieldKey, makeInitState, makeMetadata } from "./benchUtils";
import { memo } from "react";
import { useFormio } from "../src/useFormio";

export type RenderCounter = { count: number };

export const makeCounter = (): RenderCounter => ({ count: 0 });

/**
 * `counter` is a stable object identity, so it never by itself defeats `React.memo`; the only
 * prop that can change is `field`.
 */
const MemoInput = memo(function MemoInput({
  field,
  counter
}: {
  field: { value: string };
  counter: RenderCounter;
}) {
  counter.count++;
  return <input readOnly value={field.value} />;
});

// module-level caches: the props handed to `useFormio` must keep a stable identity across renders
const initStates = new Map<number, Record<string, string>>();
const metadataConfigs = new Map<number, ReturnType<typeof makeMetadata>>();
const keyLists = new Map<number, string[]>();

const initStateFor = (size: number) => {
  if (!initStates.has(size)) initStates.set(size, makeInitState(size));
  return initStates.get(size)!;
};
const metadataFor = (size: number) => {
  if (!metadataConfigs.has(size)) metadataConfigs.set(size, makeMetadata(size));
  return metadataConfigs.get(size)!;
};
export const keysFor = (size: number) => {
  if (!keyLists.has(size)) {
    keyLists.set(
      size,
      Array.from({ length: size }, (_, index) => fieldKey(index))
    );
  }
  return keyLists.get(size)!;
};

export type FormApi = ReturnType<typeof useFormio<Record<string, string>, Record<string, never>>>;

export type MemoFormProps = {
  size: number;
  counter: RenderCounter;
  /** filled in on every render so the test/bench can drive the form from the outside */
  apiRef: { current: FormApi | null };
  withMetadata?: boolean;
};

export const MemoForm = ({ size, counter, apiRef, withMetadata = false }: MemoFormProps) => {
  const form = useFormio(
    initStateFor(size),
    withMetadata ? ({ metadata: metadataFor(size) } as any) : undefined
  );
  apiRef.current = form as unknown as FormApi;

  return (
    <form>
      {keysFor(size).map(key => (
        <MemoInput key={key} field={form.fields[key]} counter={counter} />
      ))}
    </form>
  );
};
