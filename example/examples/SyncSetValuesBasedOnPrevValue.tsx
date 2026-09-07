import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

export const SyncSetValuesBasedOnPrevValue = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      ID: "",
      amount: 0
    },
    {},
    {
      ID: {
        validator: value => (value === "xxx" ? "ID cannot has value xxx" : undefined)
      },
      amount: {
        validator: value => (value === 5 ? "ID cannot has value 5" : undefined)
      }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          f.ID.set("x");
          f.ID.set(p => p + "x");
          f.ID.set(p => p + "x");
          // f.ID has value: 'xxx'
          f.amount.set(0);
          f.amount.set(p => p + 1);
          f.amount.set(p => p + 4);
          // f.amount has value 5
          const [isValid, errors] = await form.validate();

          if (isValid) {
            setResult("form is valid");
            return;
          }

          setResult(
            [
              errors.ID.length > 0 ? "there is problem with ID field" : undefined,
              errors.amount.length > 0 ? "there is problem with ID amount" : undefined
            ]
              .filter(Boolean)
              .join(", ")
          );
        }}
      >
        <button type="submit" data-testid="SyncSetValuesBasedOnPrevValue-submit">
          Submit
        </button>
        <div data-testid="SyncSetValuesBasedOnPrevValue-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};
