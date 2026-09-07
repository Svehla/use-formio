import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../src";

export const RevertToInitState = () => {
  const form = useFormio({
    firstName: "Jakub",
    lastName: "Švehla"
  });
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          form.revertToInitState();
        }}
      >
        <label>First name</label>
        <input
          type="text"
          data-testid="RevertToInitState-firstName-input"
          value={f.firstName.value}
          onChange={e => f.firstName.set(e.target.value)}
        />
        <label>Second name</label>
        <input
          type="text"
          data-testid="RevertToInitState-lastName-input"
          value={f.lastName.value}
          onChange={e => f.lastName.set(e.target.value)}
        />
        <button type="submit" disabled={form.isValidating} data-testid="RevertToInitState-submit">
          Submit and revert to init state
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};
