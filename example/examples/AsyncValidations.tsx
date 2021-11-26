import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const delay = (time: number) => new Promise(res => setTimeout(res, time));

export const AsyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: {
        validator: async () => {
          await delay(200);
          return Math.random() > 0.5 ? "Random error thrower" : undefined;
        }
      },
      lastName: {
        validator: async () => {
          await delay(1000);
          return Math.random() > 0.5 ? "Random error thrower" : undefined;
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
        <label>First name</label>
        <input
          type="text"
          onChange={e => f.firstName.set(e.target.value)}
          value={f.firstName.value}
          disabled={f.firstName.isValidating}
        />
        <div className="input-error">{f.firstName.errors.join(",")}</div>
        <label>Last name</label>
        <input
          type="text"
          onChange={e => f.lastName.set(e.target.value)}
          value={f.lastName.value}
          disabled={f.lastName.isValidating}
        />
        <div className="input-error">{f.lastName.errors.join(",")}</div>
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};
