import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useFormio } from "../../dist";

const minMaxUtil = (value, metadata) => [
  value.length > metadata.max ? "max len is " + metadata.max : undefined,
  value.length < metadata.min ? "min len is " + metadata.min : undefined
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
        firstName: val => ({
          label: "first name" + val,
          min: 10,
          max: 500
        }),

        lastName: val =>
          ({
            label: "last name",
            min: 2,
            max: 3
          } as const)
      } as const
    },

    {
      firstName: {
        validator: (value, _state, metadata) => {
          return minMaxUtil(value, metadata);
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

          console.log("a");

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
            {f.firstName.metadata.min} / Max: {f.firstName.metadata.max}
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
            {f.lastName.metadata.min} / Max: {f.lastName.metadata.max}
          </div>
        </div>

        <div className="input-error">{f.lastName.errors.join(",")}</div>

        <button type="submit">submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};
