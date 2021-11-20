import * as React from "react";
import { DEBUG_FormWrapper } from "../components";
import { Field } from "../../dist";
import { useFormio } from "../../dist";

export const RevertToInitState = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: {
        validator: v => (v === "XXX" ? "input cannot be XXX" : undefined)
      }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          form.revertToInitState();
        }}
      >
        <TextInput label={"f.firstName"} {...f.firstName} />
        <TextInput label={"f.lastName"} {...f.lastName} />
        <button disabled={form.isValidating}>
          Submit and revert to init state
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

type TextInputProps = {
  label: string;
  validateOnBlur?: boolean;
  showRerendering?: boolean;
} & Field<string>;

const TextInput = React.memo((props: TextInputProps) => {
  return (
    <div>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={e => props.set(e.target.value)}
      />
      <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
    </div>
  );
});
