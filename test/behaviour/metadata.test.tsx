// Behaviour of `extraConfig.metadata`: what it is computed from, when it is recomputed and how it
// is stabilised (shallow equality) to keep the field object identity.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormio } from "../../src/useFormio";

describe("metadata — computation", () => {
  it("is computed from the value and the whole values object", () => {
    const metadataFn = vi.fn((value: string, state: { a: string; b: number }) => ({
      len: value.length,
      sum: value.length + state.b
    }));
    const { result } = renderHook(() =>
      useFormio({ a: "xy", b: 3 }, { metadata: { a: metadataFn } })
    );
    expect(result.current.fields.a.metadata).toEqual({ len: 2, sum: 5 });
    expect(metadataFn.mock.calls[0]).toEqual(["xy", { a: "xy", b: 3 }]);
  });

  it("is undefined for a field without a metadata function", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: "y" }, { metadata: { a: (value: string) => value.length } })
    );
    expect(result.current.fields.b.metadata).toBeUndefined();
  });

  it("is undefined when no metadata config is passed", () => {
    const { result } = renderHook(() => useFormio({ a: "x" }));
    expect(result.current.fields.a.metadata).toBeUndefined();
  });

  it("supports primitive metadata", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => value.length } })
    );
    expect(result.current.fields.a.metadata).toBe(3);
  });

  it("is recomputed when the value of the field changes", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => value.length } })
    );
    act(() => result.current.fields.a.set("abcdef"));
    expect(result.current.fields.a.metadata).toBe(6);
  });

  it("is recomputed when ANOTHER field changes", () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: 1 },
        { metadata: { a: (value: string, state) => ({ label: `${value}/${state.b}` }) } }
      )
    );
    expect(result.current.fields.a.metadata).toEqual({ label: "x/1" });
    act(() => result.current.fields.b.set(2));
    expect(result.current.fields.a.metadata).toEqual({ label: "x/2" });
  });

  it("is recomputed after revertToInitState", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => value.length } })
    );
    act(() => result.current.fields.a.set("z"));
    expect(result.current.fields.a.metadata).toBe(1);
    await act(async () => {
      await result.current.revertToInitState();
    });
    expect(result.current.fields.a.metadata).toBe(3);
  });

  it("matches what getMetadata resolves with", async () => {
    const { result } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => ({ len: value.length }) } })
    );
    expect(await result.current.fields.a.getMetadata()).toEqual(result.current.fields.a.metadata);
    act(() => result.current.fields.a.set("ab"));
    expect(await result.current.fields.a.getMetadata()).toEqual(result.current.fields.a.metadata);
  });

  it("uses the metadata function of the latest render", () => {
    const { result, rerender } = renderHook(
      ({ factor }) =>
        useFormio({ a: "abc" }, { metadata: { a: (value: string) => value.length * factor } }),
      { initialProps: { factor: 1 } }
    );
    expect(result.current.fields.a.metadata).toBe(3);
    rerender({ factor: 10 });
    expect(result.current.fields.a.metadata).toBe(30);
  });

  it("picks up a metadata function added in a later render", () => {
    const { result, rerender } = renderHook(
      ({ withMetadata }) =>
        useFormio(
          { a: "abc" },
          withMetadata ? { metadata: { a: (value: string) => value.length } } : {}
        ),
      { initialProps: { withMetadata: false } }
    );
    expect(result.current.fields.a.metadata).toBeUndefined();
    rerender({ withMetadata: true });
    expect(result.current.fields.a.metadata).toBe(3);
  });
});

describe("metadata — pointer stability", () => {
  it("keeps the pointer when a new object with the same shallow content is returned", () => {
    const { result, rerender } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => ({ len: value.length }) } })
    );
    const metadata = result.current.fields.a.metadata;
    rerender();
    expect(result.current.fields.a.metadata).toBe(metadata);
    expect(result.current.fields.a).toBe(result.current.fields.a);
  });

  it("keeps the field object identity across rerenders thanks to it", () => {
    const { result, rerender } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => ({ len: value.length }) } })
    );
    const field = result.current.fields.a;
    rerender();
    rerender();
    expect(result.current.fields.a).toBe(field);
  });

  it("keeps the pointer for shallow equal arrays", () => {
    const { result, rerender } = renderHook(() =>
      useFormio({ a: "ab" }, { metadata: { a: (value: string) => value.split("") } })
    );
    const metadata = result.current.fields.a.metadata;
    rerender();
    expect(result.current.fields.a.metadata).toBe(metadata);
  });

  it("changes the pointer when the shallow content changes", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "abc" }, { metadata: { a: (value: string) => ({ len: value.length }) } })
    );
    const metadata = result.current.fields.a.metadata;
    act(() => result.current.fields.a.set("ab"));
    expect(result.current.fields.a.metadata).not.toBe(metadata);
    expect(result.current.fields.a.metadata).toEqual({ len: 2 });
  });

  it("changes the pointer when a key is added / removed", () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "abc" },
        {
          metadata: {
            a: (value: string) =>
              value.length > 2 ? { len: value.length, big: true } : { len: value.length }
          }
        }
      )
    );
    const metadata = result.current.fields.a.metadata;
    act(() => result.current.fields.a.set("ab"));
    expect(result.current.fields.a.metadata).not.toBe(metadata);
    expect(result.current.fields.a.metadata).toEqual({ len: 2 });
  });

  it("does NOT keep the pointer for deeply equal but not shallow equal metadata (documented)", () => {
    const { result, rerender } = renderHook(() =>
      useFormio(
        { a: "abc" },
        { metadata: { a: (value: string) => ({ nested: { len: value.length } }) } }
      )
    );
    const metadata = result.current.fields.a.metadata;
    rerender();
    // shallowEqual compares the nested object by reference: a new one every render
    expect(result.current.fields.a.metadata).not.toBe(metadata);
    expect(result.current.fields.a.metadata).toEqual(metadata);
  });

  it("keeps a stable pointer when the metadata function returns a constant object", () => {
    const constant = { static: true };
    const { result } = renderHook(() => useFormio({ a: "x" }, { metadata: { a: () => constant } }));
    const field = result.current.fields.a;
    act(() => result.current.fields.a.set("changed"));
    expect(result.current.fields.a.metadata).toBe(constant);
    expect(result.current.fields.a).not.toBe(field); // the value changed
  });

  it("keeps the metadata of the untouched fields when one field changes", () => {
    const { result } = renderHook(() =>
      useFormio(
        { a: "x", b: "y" },
        {
          metadata: {
            a: (value: string) => ({ len: value.length }),
            b: (value: string) => ({ len: value.length })
          }
        }
      )
    );
    const bMetadata = result.current.fields.b.metadata;
    const bField = result.current.fields.b;
    act(() => result.current.fields.a.set("changed"));
    expect(result.current.fields.b.metadata).toBe(bMetadata);
    expect(result.current.fields.b).toBe(bField);
  });

  it("changes the field identity of a field whose metadata depends on another field", () => {
    const { result } = renderHook(() =>
      useFormio({ a: "x", b: 1 }, { metadata: { a: (value: string, state) => ({ b: state.b }) } })
    );
    const aField = result.current.fields.a;
    act(() => result.current.fields.b.set(2));
    expect(result.current.fields.a).not.toBe(aField);
    expect(result.current.fields.a.value).toBe("x");
    expect(result.current.fields.a.metadata).toEqual({ b: 2 });
  });
});
