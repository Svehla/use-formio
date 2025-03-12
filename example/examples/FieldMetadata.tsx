import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

// Simple validation utility for min/max length
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
      lastName: ""
    },
    {
      metadata: {
        firstName: () => ({
          label: "First name",
          minLen: 3,
          maxLen: 10
        }),
        lastName: () => ({
          label: "Last name",
          minLen: 2,
          maxLen: 15
        })
      }
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
          const [isValid] = await form.validate();
          if (isValid) alert("form is valid");
        }}
      >
        <FormField {...f.firstName} />
        <FormField {...f.lastName} />

        <button type="submit">Submit</button>

        <div style={{ color: "red" }}>
          {Object.entries(f).map(
            ([fieldName, field]) =>
              field.errors.length > 0 && (
                <div key={fieldName} className="field-error">
                  <strong>{fieldName}:</strong> {field.errors.join(", ")}
                </div>
              )
          )}
        </div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const FormField = ({ ...field }: Field<string>) => {
  const hasErrors = field.errors.length > 0;

  return (
    <>
      <label style={{ color: hasErrors ? "red" : undefined }}>{field.metadata.label}</label>
      <input
        type="text"
        onChange={e => field.set(e.target.value)}
        value={field.value}
        style={{ borderColor: hasErrors ? "red" : undefined }}
      />

      <div style={{ color: "gray", fontSize: "0.8rem" }}>
        Used characters: {field.value.length} / Min:
        {field.metadata.minLen} / Max: {field.metadata.maxLen}
      </div>

      <div className="input-error">{field.errors.join(",")}</div>
    </>
  );
};
