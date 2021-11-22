import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const delay = (time: number) => new Promise(res => setTimeout(res, time));

const throttle = <CB extends (...args: any[]) => any>(func: CB, limit: any) => {
  let lastFunc;
  let lastRan;
  return function(...args: Parameters<CB>) {
    const context = this;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
};

const fakeCallToServer = async (search: string) => {
  await delay(1000);
  return [search, [...search.split("")].reverse().join(""), search.length.toString()];
};

/** for simplicity, this example does not show how to solve async race conditions */
export const ThrottledCallToServer = () => {
  const [results, setResults] = React.useState([] as string[]);
  const [loading, setLoading] = React.useState(false);
  const [callsToServer, setCallsToServer] = React.useState(0);

  const form = useFormio({ search: "" });

  const fetchServerData = React.useCallback(async (search: string) => {
    setLoading(true);
    setCallsToServer(p => p + 1);
    setResults(await fakeCallToServer(search));
    setLoading(false);
  }, []);

  const debouncedFetchData = React.useCallback(throttle(fetchServerData, 1000), []);

  return (
    <DEBUG_FormWrapper form={form}>
      <form onSubmit={async e => e.preventDefault()}>
        <label>Search</label>
        <input
          type="text"
          onChange={e => {
            const newValue = e.target.value;
            form.fields.search.set(newValue);
            debouncedFetchData(newValue);
          }}
          value={form.fields.search.value}
        />
        {loading && <div>loading</div>}
        {results.length > 0 && <div>we found:</div>}
        <ul>
          {results.map((result, index) => (
            <li key={index}>{result}</li>
          ))}
        </ul>
        <div>you did: {callsToServer} calls to server</div>
      </form>
    </DEBUG_FormWrapper>
  );
};
