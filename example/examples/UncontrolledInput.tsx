import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 150 + 100).join(",") + ")";

export const UncontrolledInput = () => {
  const form = useFormio(
    {
      text: ""
    },
    {
      text: {
        validator: v => (v.length < 50 ? "LENGTH SHOULD BE >= 50" : undefined)
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
          if (isValid) alert("form is valid");
        }}
      >
        <label>Text</label>
        <UncontrolledTextarea {...f.text} />
        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

const UncontrolledTextarea = React.memo((props: Field<string>) => {
  const textareaRef = React.useRef<any>(undefined);
  return (
    <div>
      <div style={{ background: getRandomRGBLightColor() }}>
        <textarea
          ref={textareaRef}
          onFocus={() => {
            if (props.errors.length !== 0) props.setErrors([]);
          }}
          onBlur={() => props.set(textareaRef.current.value)}
        />
      </div>
      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
