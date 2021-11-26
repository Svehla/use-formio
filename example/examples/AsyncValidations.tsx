import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

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
        <TextInput label={"First name"} {...f.firstName} />
        <TextInput label={"Last name"} {...f.lastName} />
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput = React.memo((props: { label: string } & Field<string>) => {
  return (
    <div>
      <label>{props.label}</label>
      <input
        type="text"
        onChange={e => props.set(e.target.value)}
        value={props.value}
        onBlur={() => props.validate()}
        disabled={props.isValidating}
      />
      <button type="button" onClick={() => props.validate()}>
        validate
      </button>
      <div className="input-error">{props.errors.join(",")}</div>
    </div>
  );
});
