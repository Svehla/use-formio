import * as React from "react";
import { DEBUG_FormWrapper } from "../components";
import { Field, useFormio } from "../../dist";

export const getRandomRGBLightColor = () => {
  return `rgb(${[
    150 + Math.random() * 100,
    150 + Math.random() * 100,
    150 + Math.random() * 100
  ].join(",")})`;
};

const MIN_TEXTAREA_LENGTH = 50;
export const UncontrolledInput = () => {
  const form = useFormio(
    {
      text: ""
    },
    {
      text: {
        validator: v =>
          v.length < MIN_TEXTAREA_LENGTH ? `LENGTH SHOULD BE >= ${MIN_TEXTAREA_LENGTH}` : undefined
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
        <div>
          <label>Text</label>
        </div>

        <UncontrolledTextarea
          set={f.text.set}
          setErrors={f.text.setErrors}
          errors={f.text.errors}
        />

        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};

type StringField = Field<string>;

const UncontrolledTextarea = React.memo(
  (props: {
    errors: StringField["errors"];
    set: StringField["set"];
    setErrors: StringField["setErrors"];
  }) => {
    const textareaRef = React.useRef<any>(undefined);

    return (
      <div style={{ background: getRandomRGBLightColor() }}>
        <textarea
          ref={textareaRef}
          onFocus={() => {
            if (props.errors.length !== 0) props.setErrors([]);
          }}
          onBlur={() => props.set(textareaRef.current.value)}
        />

        <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
      </div>
    );
  }
);
