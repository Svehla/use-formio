import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, useFormio } from "../../dist";

// ------------------------ utils --------------------------------

const minMaxUtil = (
  value: string,
  metadata: { minLen: number; maxLen: number }
): (string | undefined)[] => [
  value.length > metadata.maxLen ? "max len is " + metadata.maxLen : undefined,
  value.length < metadata.minLen ? "min len is " + metadata.minLen : undefined
];

// Higher-order function to validate only if metadata.isActive is true
const validateOnlyIfActive = <T,>(validationSchema: T): T => {
  const newSchema = { ...validationSchema };

  for (const key in newSchema) {
    // @ts-expect-error
    if (newSchema[key].validator) {
      // @ts-expect-error
      const originalValidator = newSchema[key].validator;
      // @ts-expect-error
      newSchema[key].validator = (value: any, state: any, metadata: any) => {
        if (metadata.isActive === false) {
          return undefined;
        }
        return originalValidator(value, state, metadata);
      };
    }
  }

  return newSchema;
};

// ------------------------ ----- --------------------------------

const options = ["user", "company"] as const;

export const FieldMetadata = () => {
  const form = useFormio(
    {
      type: "user" as typeof options[number],
      user_firstName: "",
      user_lastName: "",
      company_name: "",
      company_address: "",
      isOk: true
    },
    {
      metadata: {
        type: () => ({
          label: "type",
          options: options
        }),

        // return rerender deps: [val, state.type] somehow :thinking:
        user_firstName: (val, state) => ({
          // return deps:
          label: "first name: " + val,
          isActive: state.type === "user",
          minLen: 10,
          maxLen: 500
        }),

        user_lastName: (val, state) =>
          ({
            label: "last name",
            isActive: state.type === "user",
            minLen: 2,
            maxLen: 3
          } as const),

        company_name: (val, state) => ({
          label: "company name",
          isActive: state.type === "company",
          minLen: 2,
          maxLen: 3
        }),

        company_address: (val, state) => ({
          label: "company address",
          isActive: state.type === "company",
          minLen: 2,
          maxLen: 3
        })
      } as const
    },

    // TODO: add ignore, if metadata.isActive === false object high-order decorator
    // validateOnlyIfMetadataIsActive: true
    validateOnlyIfActive({
      type: {
        validator: (value, _state, metadata) => {
          return metadata.options.includes(value) ? undefined : "invalid option";
        }
      },
      user_firstName: {
        validator: (value, _state, metadata) => {
          return minMaxUtil(value, metadata);
        },
        shouldChangeValue: (_value, _state, metadata) => {
          return metadata.label !== "first name: deadlock";
        }
      },
      user_lastName: {
        validator: (value, _state, metadata) => {
          return minMaxUtil(value, metadata);
        }
      }
    })
  );

  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          // change value afterSubmit
          f.user_firstName.set(p => p + "added");
          const currentFirstNameMetadata = await f.user_firstName.getMetadata();
          console.log("currentFirstNameMetadata", currentFirstNameMetadata);

          const [isValid] = await form.validate();
          if (isValid) alert("form is valid");
        }}
      >
        <div>
          <label>{f.type.metadata.label}</label>
          <select
            onChange={e =>
              f.type.set(
                // @ts-expect-error
                e.target.value
              )
            }
            value={f.type.value}
          >
            <option value="" disabled>
              Please select
            </option>
            {options.map(option => (
              <option key={option} value={option}>
                Option {option}
              </option>
            ))}
          </select>
        </div>

        {f.user_firstName.metadata.isActive && <FormField {...f.user_firstName} />}
        {f.user_lastName.metadata.isActive && <FormField {...f.user_lastName} />}
        {f.company_name.metadata.isActive && <FormField {...f.company_name} />}
        {f.company_address.metadata.isActive && <FormField {...f.company_address} />}

        <button type="submit">submit</button>

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
