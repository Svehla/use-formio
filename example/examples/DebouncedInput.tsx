import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio } from "../../src";

export const debounce = <Args extends any[]>(
  callback: (...args: Args) => void,
  delay: number
) => {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
};

const useForm = getUseFormio(
  {
    text1: "",
    text2: ""
  },
  {},
  {
    text1: { validator: v => (v.length < 20 ? "LENGTH SHOULD BE >= 20" : undefined) },
    text2: { validator: v => (v.length < 20 ? "LENGTH SHOULD BE >= 20" : undefined) }
  }
);

export const DebouncedInput = () => {
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
        <label>Text with 500ms debounce</label>
        <MyTextArea testId="DebouncedInput-text1" {...f.text1} />
        <MyTextArea testId="DebouncedInput-text2" {...f.text2} />

        <button type="submit" disabled={form.isValidating} data-testid="DebouncedInput-submit">
          Submit
        </button>
        <div data-testid="DebouncedInput-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const getRandomRGBLightColor = () =>
  "rgb(" + [Math.random(), Math.random(), Math.random()].map(i => i * 100 + 155).join(",") + ")";

// You can't use this component with shouldUpdateValue
const MyTextArea = React.memo((props: Field<string> & { testId: string }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debouncedSet = React.useMemo(
    () => debounce((set: (typeof props)["set"]) => set(inputRef.current?.value ?? ""), 500),
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
        data-testid={`${props.testId}-input`}
        ref={inputRef}
        onChange={() => {
          if (props.errors.length > 0) props.setErrors([]);
          debouncedSet(props.set);
        }}
        onBlur={() => props.set(inputRef.current?.value ?? "")}
      />
      <button
        type="button"
        data-testid={`${props.testId}-set-hello`}
        onClick={() => props.set("hello")}
      >
        set text1 to {'"'}HELLO{'"'}
      </button>

      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});
