import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio, useFormio } from "../../dist";

export const debounce = (callback: Function, delay: number) => {
  let timeout: NodeJS.Timeout;

  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
};

const useForm = getUseFormio(
  {
    text1: "",
    text2: ""
  },
  {
    text1: { validator: v => (v.length < 20 ? "LENGTH SHOULD BE >= 20" : undefined) },
    text2: { validator: v => (v.length < 20 ? "LENGTH SHOULD BE >= 20" : undefined) }
  }
);

export const DebouncedInput = () => {
  const form = useForm();
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
        <label>Text with 500ms debounce</label>
        <MyTextArea {...f.text1} />
        <MyTextArea {...f.text2} />

        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 100 + 155).join(",") + ")";

// You can't use this component with shouldUpdateValue
const MyTextArea = React.memo((props: Field<string>) => {
  const inputRef = React.useRef<any>(undefined);
  const debouncedSet = React.useCallback(
    debounce((set: typeof props["set"]) => set(inputRef.current.value), 500),
    []
  );

  React.useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.value = props.value;
  }, [props.value]);

  return (
    <div>
      <input
        maxLength={30}
        style={{ background: getRandomRGBLightColor(), padding: "1rem" }}
        type="text"
        ref={inputRef}
        onChange={e => {
          if (props.errors.length > 0) props.setErrors([]);
          debouncedSet(props.set);
        }}
        onBlur={() => props.set(inputRef.current.value)}
      />
      <button type="button" onClick={() => props.set("hello")}>
        set text1 to {'"'}HELLO{'"'}
      </button>

      <div className="input-error">{props.errors.join(", ")}</div>
    </div>
  );
});
