import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../src";

const delay = (time: number) => new Promise(res => setTimeout(res, time));

export const AsyncValidations = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {},
    {
      firstName: {
        validator: async () => {
          await delay(200);
          return Math.random() > 0.5 ? "Random error thrower" : undefined;
        }
      },
      lastName: {
        validator: async () => {
          await delay(1000);
          return Math.random() > 0.5 ? "Random error thrower" : undefined;
        }
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
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        <TextInput testId="AsyncValidations-firstName" label={"First name"} {...f.firstName} />
        <TextInput testId="AsyncValidations-lastName" label={"Last name"} {...f.lastName} />
        <button type="submit" disabled={form.isValidating} data-testid="AsyncValidations-submit">
          Submit
        </button>
        <div data-testid="AsyncValidations-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput = React.memo(
  (props: { label: string; testId: string } & Field<string>) => {
    return (
      <div>
        <label>{props.label}</label>
        <input
          type="text"
          data-testid={`${props.testId}-input`}
          onChange={e => props.set(e.target.value)}
          value={props.value}
          onBlur={() => props.validate()}
          disabled={props.isValidating}
        />
        <button
          type="button"
          data-testid={`${props.testId}-validate`}
          onClick={() => props.validate()}
        >
          validate
        </button>
        <div className="input-error" data-testid={`${props.testId}-errors`}>
          {props.errors.join(",")}
        </div>
      </div>
    );
  }
);
