import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../src";

// Simple validation utility for min/max length
const minMaxUtil = (
  value: string,
  metadata: { minLen: number; maxLen: number }
): (string | undefined)[] => [
  value.length > metadata.maxLen ? "max len is " + metadata.maxLen : undefined,
  value.length < metadata.minLen ? "min len is " + metadata.minLen : undefined
];

export const FieldMetadata = () => {
  const [result, setResult] = React.useState("");
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
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        <FormField testId="FieldMetadata-firstName" {...f.firstName} />
        <FormField testId="FieldMetadata-lastName" {...f.lastName} />

        <button type="submit" data-testid="FieldMetadata-submit">
          Submit
        </button>

        <div style={{ color: "red" }} data-testid="FieldMetadata-errors">
          {Object.entries(f).map(
            ([fieldName, field]) =>
              field.errors.length > 0 && (
                <div key={fieldName} className="field-error">
                  <strong>{fieldName}:</strong> {field.errors.join(", ")}
                </div>
              )
          )}
        </div>
        <div data-testid="FieldMetadata-result">{result}</div>
      </form>
    </DEBUG_FormWrapper>
  );
};

const FormField = ({ testId, ...field }: Field<string> & { testId: string }) => {
  const hasErrors = field.errors.length > 0;

  return (
    <>
      <label style={{ color: hasErrors ? "red" : undefined }}>{field.metadata.label}</label>
      <input
        type="text"
        data-testid={`${testId}-input`}
        onChange={e => field.set(e.target.value)}
        value={field.value}
        style={{ borderColor: hasErrors ? "red" : undefined }}
      />

      <div style={{ color: "gray", fontSize: "0.8rem" }}>
        Used characters: {field.value.length} / Min:
        {field.metadata.minLen} / Max: {field.metadata.maxLen}
      </div>

      <div className="input-error" data-testid={`${testId}-errors`}>
        {field.errors.join(",")}
      </div>
    </>
  );
};
