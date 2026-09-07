import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

const delay = (time: number) => new Promise(res => setTimeout(res, time));

const throttle = <Args extends any[]>(func: (...args: Args) => void, limit: number) => {
  let lastFunc: ReturnType<typeof setTimeout> | undefined;
  let lastRan: number | undefined;

  return (...args: Args) => {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - (lastRan as number) >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
};

const fakeHTTPCallService = async (search: string) => {
  await delay(500);
  return [search, [...search.split("")].reverse().join(""), search.length.toString()];
};

export const ThrottledCallToServer = () => {
  const [results, setResults] = React.useState([] as string[]);
  const [loading, setLoading] = React.useState(false);
  const [callsToServer, setCallsToServer] = React.useState(0);
  const form = useFormio({ search: "" });

  const fetchData = React.useCallback(async (search: string) => {
    setLoading(true);
    setResults(await fakeHTTPCallService(search));
    setCallsToServer(p => p + 1);
    setLoading(false);
  }, []);

  const throttledFetchData = React.useMemo(() => throttle(fetchData, 1000), [fetchData]);

  return (
    <DEBUG_FormWrapper form={form}>
      <form onSubmit={async e => e.preventDefault()}>
        <label>
          Search
          {loading && <span data-testid="ThrottledCallToServer-loading">(loading)</span>}
        </label>
        <input
          type="text"
          data-testid="ThrottledCallToServer-search-input"
          onChange={e => {
            const newValue = e.target.value;
            form.fields.search.set(newValue);
            throttledFetchData(newValue);
          }}
          value={form.fields.search.value}
        />
        {results.length > 0 && <div>we found:</div>}
        <ul data-testid="ThrottledCallToServer-result">
          {results.map((result, index) => (
            <li key={index}>{result}</li>
          ))}
        </ul>
        <div data-testid="ThrottledCallToServer-calls-count">
          you did: {callsToServer} calls to server
        </div>
      </form>
    </DEBUG_FormWrapper>
  );
};
