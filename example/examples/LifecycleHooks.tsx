import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

export const LifecycleHooks = () => {
  const form = useFormio(
    {
      ID: "",
      age: ""
    },
    {
      metadata: {
        ID: () => ({
          label: "ID"
        }),
        age: () => ({
          label: "Age"
        })
      }
    },
    {
      ID: {
        hookAfterSet: (value, state, { metadata }) => {
          console.log("hookAfterSet", metadata.label, value, state);
        }
      },
      age: {
        hookAfterSet: (value, state, { metadata }) => {
          console.log("hookAfterSet", metadata.label, value, state);
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
        <label>ID</label>
        <input type="text" onChange={e => f.ID.set(e.target.value)} value={f.ID.value} />
        <div className="input-error">{f.ID.errors.join(",")}</div>
        <label>age</label>
        <input type="text" onChange={e => f.age.set(e.target.value)} value={f.age.value} />
        <div className="input-error">{f.age.errors.join(",")}</div>
        <button type="submit">Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
