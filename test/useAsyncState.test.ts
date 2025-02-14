import { _useAsyncState } from "../src/useFormio";
import { act, renderHook } from "@testing-library/react-hooks";
// import { useCallback, useEffect } from 'react';

describe("useAsyncState", () => {
  it("1", async () => {
    const { result } = renderHook(() => _useAsyncState("a"));
    const [value, setValue, getValue] = result.current;

    // !!!!!!! MISSING AWAIT !!!!!!!
    // await is missing here!! for purpose!!!! we want to test our custom await mechanism to check
    // async state of react state change
    act(async () => {
      setValue("aaaa");
    })
      // then method is called to ignore console.error warning from @testing-library/react-hooks
      .then(() => null);

    expect(value).toBe("a");
    const val = await getValue();
    expect(val).toBe("aaaa");
  });

  // TODO: add use case with useCallback/useMemo
});
