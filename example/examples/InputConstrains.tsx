import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const isInteger = (val: string) => parseInt(val).toString() === val;
const maxLen = (maxLenSize: number) => (value: string) => value.length <= maxLenSize;

export const InputConstrains = () => {
  const form = useFormio(
    {
      ID: "",
      age: ""
    },
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
