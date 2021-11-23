import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio } from "../../dist";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

const useForm = getUseFormio(
  {
    firstName: "",
    lastName: ""
  },
  {
    firstName: {
      // stable validator pointer out of the box
      validator: (v, s) =>
        s.lastName === v ? "last name cannot be the same as the first name" : undefined,
      shouldChangeValue: v => v.length <= 20
    },
    lastName: {
      validator: v => (v.trim().length === 0 ? "field is required" : undefined),
      shouldChangeValue: v => v.length <= 20
    }
  }
);

export const OptimizedObjectRecreating = () => {
  const form = useForm();
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
        <button type="submit">Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};

/**
 * thanks to the stable pointer of methods + React.memo,
 * the component is rerendered only if value is changed
 */
const TextInput = React.memo((props: { label: string } & Field<string>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input
          type="text"
          value={props.value}
          onChange={e => props.set(e.target.value)}
          onBlur={props.validate}
        />
      </div>
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
