import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio } from "../../src";

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

const useForm = getUseFormio(
  {
    text: ""
  },
  {},
  {
    text: {
      validator: v => (v.length < 50 ? "LENGTH SHOULD BE >= 50" : undefined)
    }
  }
);

export const UncontrolledInput = () => {
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
        <label>Text</label>
        <UncontrolledTextarea testId="UncontrolledInput-text" {...f.text} />
        <button type="submit" disabled={form.isValidating} data-testid="UncontrolledInput-submit">
          Submit
        </button>
        <div data-testid="UncontrolledInput-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const UncontrolledTextarea = React.memo((props: Field<string> & { testId: string }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <div style={{ background: getRandomRGBLightColor() }}>
        <textarea
          ref={textareaRef}
          data-testid={`${props.testId}-input`}
          onFocus={() => {
            if (props.errors.length !== 0) props.setErrors([]);
          }}
          onBlur={() => props.set(textareaRef.current?.value ?? "")}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});
