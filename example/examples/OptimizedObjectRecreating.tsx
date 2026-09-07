import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio } from "../../src";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

const useForm = getUseFormio(
  {
    firstName: "",
    lastName: ""
  },
  {},
  {
    firstName: {
      // stable validator pointer out of the box
      validator: (v, s) =>
        s.lastName === v ? "last name cannot be the same as the first name" : undefined,
      shouldChangeValue: v => v.length <= 20
    },
    lastName: {
      validator: v => (v.trim().length === 0 ? "field is required" : undefined),
      shouldChangeValue: v => v.length <= 20
    }
  }
);

export const OptimizedObjectRecreating = () => {
  const [result, setResult] = React.useState("");
  const form = useForm();
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
        <TextInput1
          testId="OptimizedObjectRecreating-firstName"
          label={"First name"}
          {...f.firstName}
        />
        <TextInput2
          testId="OptimizedObjectRecreating-lastName"
          label={"Last name"}
          field={f.lastName}
        />
        <button type="submit" data-testid="OptimizedObjectRecreating-submit">
          Submit
        </button>
        <div data-testid="OptimizedObjectRecreating-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const TextInput1 = React.memo((props: { label: string; testId: string } & Field<string>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input
          type="text"
          data-testid={`${props.testId}-input`}
          value={props.value}
          onChange={e => props.set(e.target.value)}
          onBlur={props.validate}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});

const TextInput2 = React.memo(
  (props: { label: string; testId: string; field: Field<string> }) => {
    return (
      <div>
        <label>{props.label}</label>
        <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
          <input
            type="text"
            data-testid={`${props.testId}-input`}
            value={props.field.value}
            onChange={e => props.field.set(e.target.value)}
            onBlur={props.field.validate}
          />
        </div>
        <div className="input-error" data-testid={`${props.testId}-errors`}>
          {props.field.errors.join(", ")}
        </div>
      </div>
    );
  }
);
