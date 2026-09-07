import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../src";

const useWasFieldInvalid = (field: { errors: string[] }) => {
  const [wasInvalid, setWasInvalid] = React.useState(false);
  React.useEffect(() => {
    if (field.errors.length > 0) setWasInvalid(true);
  }, [field.errors]);
  return wasInvalid;
};

const minLength10 = (value: string) =>
  value.length < 10 ? "value has to have length >= 10" : undefined;

export const OnTouchValidation = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {},
    {
      firstName: { validator: minLength10 },
      lastName: { validator: minLength10 }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          const [isValid] = await form.validate();
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        <TextInput testId="OnTouchValidation-firstName" label={"First name"} {...f.firstName} />
        <TextInput testId="OnTouchValidation-lastName" label={"Last name"} {...f.lastName} />
        <button type="submit" data-testid="OnTouchValidation-submit">
          Submit
        </button>
        <div data-testid="OnTouchValidation-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput = React.memo((props: { label: string; testId: string } & Field<string>) => {
  const wasFieldInvalid = useWasFieldInvalid(props);
  return (
    <div>
      <label>{props.label}</label>
      <input
        type="text"
        data-testid={`${props.testId}-input`}
        value={props.value}
        onChange={e => {
          props.set(e.target.value);
          if (wasFieldInvalid) props.validate();
        }}
      />
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});
