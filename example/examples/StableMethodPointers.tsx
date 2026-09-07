import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field } from "../../src";
import { useFormio } from "../../src";

// validator functions has to be stable pointer to optimise React runtime
export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

export const StableMethodPointers = () => {
  const [result, setResult] = React.useState("");
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {},
    {
      firstName: { validator: isRequired },
      lastName: { validator: isRequired }
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
        <TextInput testId="StableMethodPointers-firstName" label={"f.firstName"} {...f.firstName} />
        <TextInput testId="StableMethodPointers-lastName" label={"f.lastName"} {...f.lastName} />
        <button
          type="submit"
          disabled={form.isValidating}
          data-testid="StableMethodPointers-submit"
        >
          Submit
        </button>
        <div data-testid="StableMethodPointers-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

/**
 * component si rerendered even if input is valid
 * because isValidating is changed from false to true and back to false
 */
const TextInput = React.memo((props: Field<string> & { label: string; testId: string }) => {
  return (
    <div>
      <label>{props.label}</label>
      <div style={{ background: getRandomRGBLightColor(), padding: "1rem" }}>
        <input
          type="text"
          data-testid={`${props.testId}-input`}
          value={props.value}
          onChange={e => props.set(e.target.value)}
          disabled={props.isValidating}
          onBlur={props.validate}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});
