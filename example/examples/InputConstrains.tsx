import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

const isInteger = (val: string) => parseInt(val).toString() === val;
const maxLen = (maxLenSize: number) => (value: string) => value.length <= maxLenSize;

export const InputConstrains = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      ID: "",
      age: ""
    },
    {},
    {
      ID: {
        shouldChangeValue: maxLen(10)
      },
      age: {
        shouldChangeValue: isInteger
      }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          const [isValid] = await form.validate();
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        <label>ID</label>
        <input
          type="text"
          data-testid="InputConstrains-ID-input"
          onChange={e => f.ID.set(e.target.value)}
          value={f.ID.value}
        />
        <div className="input-error" data-testid="InputConstrains-ID-errors">
          {f.ID.errors.join(",")}
        </div>
        <label>age</label>
        <input
          type="text"
          data-testid="InputConstrains-age-input"
          onChange={e => f.age.set(e.target.value)}
          value={f.age.value}
        />
        <div className="input-error" data-testid="InputConstrains-age-errors">
          {f.age.errors.join(",")}
        </div>
        <button type="submit" data-testid="InputConstrains-submit">
          Submit
        </button>
        <div data-testid="InputConstrains-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};
