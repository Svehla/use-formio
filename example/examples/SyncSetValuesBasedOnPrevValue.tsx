import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

export const SyncSetValuesBasedOnPrevValue = () => {
  const form = useFormio(
    {
      ID: "",
      amount: 0
    },
    {},
    {
      ID: {
        validator: value => (value === "xxx" ? "ID cannot has value xxx" : undefined)
      },
      amount: {
        validator: value => (value === 5 ? "ID cannot has value 5" : undefined)
      }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          f.ID.set("x");
          f.ID.set(p => p + "x");
          f.ID.set(p => p + "x");
          // f.ID has value: 'xxx'
          f.amount.set(0);
          f.amount.set(p => p + 1);
          f.amount.set(p => p + 4);
          // f.amount has value 5
          const [isValid, errors] = await form.validate();

          const fields = await form.getFieldsState();

          if (isValid) return;
          if (errors.ID.length > 0) {
            alert("there is problem with ID field");
          }
          if (errors.amount.length > 0) {
            alert("there is problem with ID amount");
          }
        }}
      >
        <button type="submit">Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
