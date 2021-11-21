import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

export const debounce = <CB extends (...args: any[]) => any>(callback: CB, delay: number) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<CB>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
};

export const DebouncedInput = () => {
  const form = useFormio(
    {
      text: ""
    },
    {
      text: {
        validator: v => (v.length < 200 ? "LENGTH SHOULD BE >= 200" : undefined)
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
        <label>Text with 1000ms debounce</label>
        <MyTextArea {...f.text} />
        <div className="input-error">{f.text.errors.join(", ")}</div>

        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};

// this component si rendered only once per instance because set is stable pointer
const MyTextArea = React.memo((props: Field<string>) => {
  const inputRef = React.useRef<any>(undefined);
  const debouncedSet = debounce(props.set, 1000);

  return (
    <input
      type="text"
      ref={inputRef}
      onChange={e => debouncedSet(e.target.value)}
      onFocus={() => props.setErrors([])}
      onBlur={() => props.set(inputRef.current.value)}
    />
  );
});
