import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

export const LifecycleHooks = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      ID: "",
      age: 0
    },
    {
      metadata: {
        ID: () =>
          ({
            label: "ID"
          } as const),
        age: () =>
          ({
            label: "Age"
          } as const)
      },
      globalHooks: {
        afterSet: async (key, value, state) => {
          const allData = await form.getFormValues();
          console.log("globalHookAfterSet", key, value, state);
          console.log(allData);
        }
      },
      hooks: {
        ID: {
          afterSet: (value, state, { metadata }) => {
            console.log("hookAfterSet", metadata.label, value, state);
          }
        },
        age: {
          afterSet: (value, state, { metadata }) => {
            console.log("hookAfterSet", metadata.label, value, state);
          }
        }
      }
    },
    {}
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
          data-testid="LifecycleHooks-ID-input"
          onChange={e => f.ID.set(e.target.value)}
          value={f.ID.value}
        />
        <div className="input-error" data-testid="LifecycleHooks-ID-errors">
          {f.ID.errors.join(",")}
        </div>
        <label>age</label>
        <input
          type="number"
          data-testid="LifecycleHooks-age-input"
          onChange={e => f.age.set(Number(e.target.value))}
          value={f.age.value}
        />
        <div className="input-error" data-testid="LifecycleHooks-age-errors">
          {f.age.errors.join(",")}
        </div>
        <button type="submit" data-testid="LifecycleHooks-submit">
          Submit
        </button>
        <div data-testid="LifecycleHooks-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};
