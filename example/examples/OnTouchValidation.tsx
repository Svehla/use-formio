import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

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

const TextInput = React.memo((props: { label: string } & Field<string>) => {
  const wasFieldInvalid = useWasFieldInvalid(props);
  return (
    <div>
      <label>{props.label}</label>
      <input
        type="text"
        value={props.value}
        onChange={e => {
          props.set(e.target.value);
          if (wasFieldInvalid) props.validate();
        }}
      />
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
