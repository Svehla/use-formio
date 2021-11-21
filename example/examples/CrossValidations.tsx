import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

/**
 * demonstrate how to do that 1 input validations depends on value of another input
 */
export const CrossValidations = () => {
  const form = useFormio(
    {
      parentID: "",
      age: ""
    },
    {
      parentID: {
        // for dependencies between inputs we use the second argument of validator fn
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
          if (isValid) alert("form is valid");
        }}
      >
        <label>parentID</label>
        <input
          type="text"
          onChange={e => f.parentID.set(e.target.value)}
          value={f.parentID.value}
        />
        <div className="input-error">{f.parentID.errors.join(",")}</div>

        <label>age</label>
        <input type="number" onChange={e => f.age.set(e.target.value)} value={f.age.value} />
        <div className="input-error">{f.age.errors.join(",")}</div>
        <button type="submit">Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
