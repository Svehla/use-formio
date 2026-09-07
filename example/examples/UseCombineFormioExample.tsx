import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useCombineFormio, useFormio } from "../../src";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

export const UseCombineFormioExample = () => {
  const [result, setResult] = React.useState("");
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
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        <TextInput
          testId="UseCombineFormioExample-a-firstName"
          label="a - First name"
          {...form.forms.a.fields.firstName}
        />
        <TextInput
          testId="UseCombineFormioExample-a-lastName"
          label="a - LastName"
          {...form.forms.a.fields.lastName}
        />
        <TextInput
          testId="UseCombineFormioExample-b-age"
          label="b - Age"
          {...form.forms.b.fields.age}
        />
        <TextInput
          testId="UseCombineFormioExample-b-id"
          label="b - Id"
          {...form.forms.b.fields.id}
        />
        <button
          type="submit"
          disabled={form.isValidating}
          data-testid="UseCombineFormioExample-submit"
        >
          Submit
        </button>
        <div data-testid="UseCombineFormioExample-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput = React.memo((props: { label: string; testId: string } & Field<string>) => (
  <div>
    <label>{props.label}</label>
    <input
      value={props.value}
      type="text"
      data-testid={`${props.testId}-input`}
      disabled={props.isValidating}
      onChange={e => props.set(e.target.value)}
    />
    <div className="input-error" data-testid={`${props.testId}-errors`}>
      {props.errors.join(", ")}
    </div>
  </div>
));
