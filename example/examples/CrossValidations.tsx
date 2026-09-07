import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

/** demonstrate how to do that 1 input validations depends on value of another input */
export const CrossValidations = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      parentID: "",
      age: "15"
    },
    {},
    {
      parentID: {
        validator: (value, state) => {
          const isOlder18 = parseInt(state.age) < 18;
          if (!isOlder18) return undefined;
          return value.trim() === ""
            ? "parent ID is required for people younger 18 years"
            : undefined;
        }
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
        <label>parent ID</label>
        <input
          type="text"
          data-testid="CrossValidations-parentID-input"
          onChange={e => f.parentID.set(e.target.value)}
          value={f.parentID.value}
        />
        <div className="input-error" data-testid="CrossValidations-parentID-errors">
          {f.parentID.errors.join(",")}
        </div>
        <label>age</label>
        <input
          type="number"
          data-testid="CrossValidations-age-input"
          onChange={e => f.age.set(e.target.value)}
          value={f.age.value}
        />
        <div className="input-error" data-testid="CrossValidations-age-errors">
          {f.age.errors.join(",")}
        </div>
        <button type="submit" data-testid="CrossValidations-submit">
          Submit
        </button>
        <div data-testid="CrossValidations-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};
