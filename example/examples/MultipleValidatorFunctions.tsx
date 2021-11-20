import * as React from "react";
import { DEBUG_FormWrapper } from "../components";
import { Field } from "../../dist";
import { useCallback } from "react";
import { useFormio } from "../../dist";

const isRequired = (value: string) =>
  value.trim() === "" ? "Field cannot be empty" : undefined;
const isInteger = (val: string) => parseInt(val).toString() === val;

export const MultipleValidatorFunctions = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      age: ""
    },
    {
      firstName: {
        validator: v => (v === "XXX" ? "input cannot be XXX" : undefined)
      },
      lastName: {
        validator: isRequired,
        shouldChangeValue: v => v.length <= 30
      },
      age: {
        shouldChangeValue: v =>
          v.length === 0 ? true : isInteger(v) && v.length <= 2
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
        <TextInput label={"f.firstName"} {...f.firstName} />
        <TextInput label={"f.lastName"} {...f.lastName} />
        <TextInput label={"f.age"} {...f.age} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};

type TextInputProps = {
  label: string;
  validateOnBlur?: boolean;
  showRerendering?: boolean;
} & Field<string>;

const getRandomRGBLightColor = () => {
  return `rgb(${[
    150 + Math.random() * 100,
    150 + Math.random() * 100,
    150 + Math.random() * 100
  ].join(",")})`;
};

const TextInput = React.memo((props: TextInputProps) => {
  const onChange = useCallback((e: any) => props.set(e.target.value), []);
  const onBlur = React.useMemo(
    () => (props.validateOnBlur ? () => props.validate() : undefined),
    [props.validateOnBlur]
  );

  return (
    <div
      style={
        props.showRerendering
          ? { background: getRandomRGBLightColor() }
          : undefined
      }
    >
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={onChange}
        onBlur={onBlur}
      />
      <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
    </div>
  );
});
