import * as React from "react";
import { DEBUG_FormWrapper } from "../components";
import { useFormio } from "../../dist";

const validate3 = (val: string) =>
  val.includes("3") ? "you cannot write `3` into the input" : undefined;
const isInteger = (val: string) =>
  parseInt(val).toString() === val ? undefined : "only int is valid input";
const maxLen10 = (val: string) => (val.length > 10 ? "max len is 10" : undefined);
const minLen4 = (val: string) => (val.length < 4 ? "min len is 4" : undefined);

export const SyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      randomInt: ""
    },
    {
      firstName: {
        validator: value => (value.trim() === "" ? `Input can't be empty` : undefined)
      },
      lastName: {
        validator: value => {
          const err1 = value.includes(" ") ? "last name can not include a space" : undefined;

          const err2 = value.length > 20 ? "Max size of last name is 20 characters" : undefined;

          return [err1, err2];
        }
      },
      randomInt: {
        validator: value => [validate3, isInteger, maxLen10, minLen4].map(fn => fn(value))
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
            <label>first name</label>
          </div>
          <input
            type="text"
            onChange={e => f.firstName.set(e.target.value)}
            value={f.firstName.value}
          />
          <div style={{ color: "red" }}>{f.firstName.errors.join(",")}</div>
        </div>
        <div>
          <div>
            <label>random int</label>
          </div>
          <input
            type="number"
            onChange={e => f.randomInt.set(e.target.value)}
            value={f.randomInt.value}
          />
          <div style={{ color: "red" }}>{f.randomInt.errors.join(",")}</div>
        </div>
        <div>
          <div>
            <label>last name</label>
          </div>
          <input
            type="text"
            onChange={e => f.lastName.set(e.target.value)}
            value={f.lastName.value}
          />
          <div style={{ color: "red" }}>{f.lastName.errors.join(",")}</div>
        </div>
        <button>submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
