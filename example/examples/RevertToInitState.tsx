import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field } from "../../dist";
import { useFormio } from "../../dist";

export const RevertToInitState = () => {
  const form = useFormio({
    firstName: "",
    lastName: ""
  });

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
        <button type="submit" disabled={form.isValidating}>
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
      <div className="error-msg">{props.errors.join(", ")}</div>
    </div>
  );
});
