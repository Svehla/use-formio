import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useCombineFormio, useFormio } from "../../dist";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

export const UseCombineFormioExample = () => {
  const form = useCombineFormio({
    a: useFormio(
      {
        firstName: "",
        lastName: ""
      },
      {},
      {
        firstName: { validator: isRequired },
        lastName: { validator: isRequired }
      }
    ),
    b: useFormio(
      {
        age: "",
        id: ""
      },
      {},
      {
        age: { validator: isRequired },
        id: { validator: isRequired }
      }
    )
  });
  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          const [isValid] = await form.validate();
          if (isValid) alert("form is valid");
        }}
      >
        <TextInput label="a - First name" {...form.forms.a.fields.firstName} />
        <TextInput label="a - LastName" {...form.forms.a.fields.lastName} />
        <TextInput label="b - Age" {...form.forms.b.fields.age} />
        <TextInput label="b - Id" {...form.forms.b.fields.id} />
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput = React.memo((props: { label: string } & Field<string>) => (
  <div>
    <label>{props.label}</label>
    <input
      value={props.value}
      type="text"
      disabled={props.isValidating}
      onChange={e => props.set(e.target.value)}
    />
    <div className="input-error">{props.errors.join(", ")}</div>
  </div>
));
