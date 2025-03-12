import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const minMaxUtil = (
  value: string,
  metadata: { minLen: number; maxLen: number }
): (string | undefined)[] => [
  value.length > metadata.maxLen ? "max len is " + metadata.maxLen : undefined,
  value.length < metadata.minLen ? "min len is " + metadata.minLen : undefined
];

export const FieldMetadata = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      isOk: true
    },
    {
      metadata: {
        firstName: (val, state) => ({
          label: "first name: " + val,
          minLen: 10,
          maxLen: 500

          // TODO: create isActive abstraction for: skipping validation if not active
          // isActive: state.lastName === "333"
        }),

        lastName: () =>
          ({
            label: "last name",
            minLen: 2,
            maxLen: 3
          } as const)
      } as const
    },

    // TODO: add ignore, if metadata.isActive === false object high-order decorator
    {
      firstName: {
        validator: (value, _state, metadata) => {
          return minMaxUtil(value, metadata);
        },
        shouldChangeValue: (_value, _state, metadata) => {
          return metadata.label !== "first name: deadlock";
        }
      },
      lastName: {
        validator: (value, _state, metadata) => {
          return minMaxUtil(value, metadata);
        }
      }
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          // change value afterSubmit
          f.firstName.set(p => p + "added");
          const currentFirstNameMetadata = await f.firstName.getMetadata();
          console.log("currentFirstNameMetadata", currentFirstNameMetadata);

          const [isValid] = await form.validate();
          if (isValid) alert("form is valid");
        }}
      >
        <label>{f.firstName.metadata.label}</label>
        <input
          type="text"
          onChange={e => f.firstName.set(e.target.value)}
          value={f.firstName.value}
        />

        <div>
          <div>
            Used characters: {f.firstName.value.length} / Min:
            {f.firstName.metadata.minLen} / Max: {f.firstName.metadata.maxLen}
          </div>
        </div>

        <div className="input-error">{f.firstName.errors.join(",")}</div>

        <label>{f.lastName.metadata.label}</label>
        <input
          type="text"
          onChange={e => f.lastName.set(e.target.value)}
          value={f.lastName.value}
        />

        <div>
          <div>
            Used characters: {f.lastName.value.length} / Min:
            {f.lastName.metadata.minLen} / Max: {f.lastName.metadata.maxLen}
          </div>
        </div>

        <div className="input-error">{f.lastName.errors.join(",")}</div>

        <button type="submit">submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
