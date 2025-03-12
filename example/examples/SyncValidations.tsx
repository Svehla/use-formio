import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

export const SyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      age: "",
      isVerified: false
    },
    {},
    {
      firstName: {
        validator: value => [
          value.length > 10 ? "max len is 10" : undefined,
          value.length < 4 ? "min len is 4" : undefined
        ]
      },
      age: {
        validator: value => [
          value === "" ? "input cannot be empty" : undefined,
          parseInt(value) < 18 ? "age has to be > 18" : undefined
        ]
      },
      isVerified: {
        validator: value => (value === false ? "value has to be checked" : undefined)
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
        <label>First name</label>
        <input
          type="text"
          onChange={e => f.firstName.set(e.target.value)}
          value={f.firstName.value}
        />
        <div className="input-error">{f.firstName.errors.join(",")}</div>
        <label>Age</label>
        <input type="number" onChange={e => f.age.set(e.target.value)} value={f.age.value} />
        <div className="input-error">{f.age.errors.join(",")}</div>
        <label>Terms of conditions</label>
        <input
          type="checkbox"
          checked={f.isVerified.value}
          onChange={e => f.isVerified.set(e.target.checked)}
        />
        <div className="input-error">{f.isVerified.errors.join(", ")}</div>
        <button type="submit">submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
