import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const maxLen3 = (val: string) => (val.length > 3 ? "max len is 10" : undefined);
const minLen1 = (val: string) => (val.length < 1 ? "min len is 4" : undefined);

export const SyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      age: "",
      isVerified: false
    },
    {
      firstName: {
        validator: value => (value.trim() === "" ? "Input can't be empty" : undefined)
      },
      age: {
        validator: value => [maxLen3(value), minLen1(value)]
      },
      isVerified: {
        validator: value => (value === false ? "value has to be checked" : undefined)
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
          alert(isValid);
        }}
      >
        <div>
          <div>
            <label>First name</label>
          </div>
          <input
            type="text"
            onChange={e => f.firstName.set(e.target.value)}
            value={f.firstName.value}
          />
          <div className="error-msg">{f.firstName.errors.join(",")}</div>
        </div>

        <div>
          <div>
            <label>Age</label>
          </div>
          <input type="number" onChange={e => f.age.set(e.target.value)} value={f.age.value} />
          <div className="error-msg">{f.age.errors.join(",")}</div>
        </div>

        <div>
          <div>
            <label>Terms of conditions</label>
          </div>
          <input
            type="checkbox"
            checked={f.isVerified.value}
            onChange={e => f.isVerified.set(e.target.checked)}
          />
        </div>
        <div className="error-msg">{f.isVerified.errors.join(", ")}</div>
        <button type="submit">submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
