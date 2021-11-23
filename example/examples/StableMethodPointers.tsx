import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field } from "../../dist";
import { useFormio } from "../../dist";

// validator functions has to be stable pointer to optimise React runtime
export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

export const StableMethodPointers = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: { validator: isRequired },
      lastName: { validator: isRequired }
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
        <TextInput label={"f.firstName"} {...f.firstName} />
        <TextInput label={"f.lastName"} {...f.lastName} />
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

/**
 * thanks to the stable pointer of methods + React.memo,
 * the component is rerendered only if value is changed
 */
const TextInput = React.memo((props: Field<string> & { label: string }) => {
  return (
    <div>
      <label>{props.label}</label>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input
          type="text"
          value={props.value}
          onChange={e => props.set(e.target.value)}
          disabled={props.isValidating}
          onBlur={props.validate}
        />
      </div>
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
