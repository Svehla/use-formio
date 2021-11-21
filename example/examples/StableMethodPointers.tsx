import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field } from "../../dist";
import { useFormio } from "../../dist";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field cannot be empty" : undefined;

const getRandomRGBLightColor = () => {
  return (
    "rgb(" +
    [150 + Math.random() * 100, 150 + Math.random() * 100, 150 + Math.random() * 100].join(",") +
    ")"
  );
};

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
  validateOnBlur?: boolean;

  value: TextField["value"];
  set: TextField["set"];
  errors: TextField["errors"];
};

const TextInput = React.memo((props: TextInputProps) => {
  return (
    <div>
      <h3>{props.label}</h3>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input value={props.value} type="text" onChange={e => props.set(e.target.value)} />
      </div>
      <div className="error-msg">{props.errors.join(", ")}</div>
    </div>
  );
});
