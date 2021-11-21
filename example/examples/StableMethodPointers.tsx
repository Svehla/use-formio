import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field } from "../../dist";
import { useFormio } from "../../dist";

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
      firstName: {
        validator: isRequired
      },
      lastName: {
        validator: isRequired
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
        {/*
          thanks to stable pointer + React.memo,
          the component is rerendered only if value is changed
         */}
        <TextInput
          label={"f.firstName"}
          value={f.firstName.value}
          set={f.firstName.set}
          errors={f.firstName.errors}
        />
        <TextInput
          label={"f.lastName"}
          value={f.lastName.value}
          set={f.lastName.set}
          errors={f.lastName.errors}
        />
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

type TextField = Field<string>;
type TextInputProps = {
  label: string;

  value: TextField["value"];
  set: TextField["set"];
  errors: TextField["errors"];
};

const TextInput = React.memo((props: TextInputProps) => {
  return (
    <div>
      <label>{props.label}</label>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input value={props.value} type="text" onChange={e => props.set(e.target.value)} />
      </div>
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
