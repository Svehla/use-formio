import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio, useFormio } from "../../dist";

// -------------- custom declarative metadata validation framework  --------------
const transformValidationSchema = <T,>(
  validationSchema: T,
  transformFn: (key: string, schema: any) => any
): T => {
  const newSchema = { ...validationSchema };

  for (const key in newSchema) {
    newSchema[key] = transformFn(key, newSchema[key] || {});
  }

  return newSchema;
};

const validateOnlyIfActive = <T,>(validationSchema: T): T => {
  return transformValidationSchema(validationSchema, (_, schema) => {
    if (!schema.validator) return schema;

    const originalValidator = schema.validator;
    return {
      ...schema,
      validator: (value: any, state: any, metadata?: any) => {
        if (metadata?.isActive === false) {
          return undefined;
        }
        return originalValidator(value, state, metadata);
      }
    };
  });
};

const enforceOptionsValidation = <T,>(validationSchema: T): T => {
  return transformValidationSchema(validationSchema, (_, schema) => {
    const originalShouldChangeValue = schema.shouldChangeValue;

    return {
      ...schema,
      shouldChangeValue: (newValue: any, prevState: any, metadata?: any) => {
        if (metadata?.options && !metadata.options.includes(newValue)) {
          return false;
        }

        return originalShouldChangeValue
          ? originalShouldChangeValue(newValue, prevState, metadata)
          : true;
      }
    };
  });
};

const addMinMaxValidation = <T,>(validationSchema: T): T => {
  return transformValidationSchema(validationSchema, (_, schema) => {
    const originalValidator = schema.validator;

    return {
      ...schema,
      validator: (value: any, state: any, metadata?: any) => {
        const originalResult = originalValidator ? originalValidator(value, state, metadata) : [];

        if (
          typeof value === "string" &&
          (metadata.minLen !== undefined || metadata.maxLen !== undefined)
        ) {
          const minLen = metadata.minLen || 0;
          const maxLen = metadata.maxLen || Infinity;

          const minMaxResults = [
            value.length > maxLen ? "max len is " + maxLen : undefined,
            value.length < minLen ? "min len is " + minLen : undefined
          ];

          return [
            ...(Array.isArray(originalResult) ? originalResult : [originalResult]),
            ...minMaxResults
          ].filter(Boolean);
        }

        return originalResult;
      }
    };
  });
};

const applyValidationEnhancements = (initStateArg: any, extraConfig?: any, stateSchema?: any) => {
  const stateSchemaWithEmptyKeys = {
    ...stateSchema,
    ...Object.fromEntries(
      Object.entries(initStateArg)
        .filter(([key]) => !stateSchema || !(key in stateSchema))
        .map(([key]) => [key, {}])
    )
  } as typeof stateSchema;

  return validateOnlyIfActive(
    addMinMaxValidation(
      enforceOptionsValidation(
        //
        stateSchemaWithEmptyKeys
      )
    )
  );
};

const enhanced_getUseFormio = (((initStateArg: any, extraConfig?: any, stateSchema?: any) => {
  return getUseFormio(
    initStateArg,
    extraConfig,
    applyValidationEnhancements(initStateArg, extraConfig, stateSchema)
  );
}) as any) as typeof getUseFormio;

const useFormioEnhanced = (((initStateArg: any, extraConfig?: any, stateSchema?: any) => {
  return useFormio(
    initStateArg,
    extraConfig,
    applyValidationEnhancements(initStateArg, extraConfig, stateSchema)
  );
}) as any) as typeof useFormio;

// -------------- -------------------------------------------------- --------------

// form enum definitions
const typeOptions = ["user", "company"] as const;

export const AdvancedFieldMetadataValidations = () => {
  const form = useFormioEnhanced(
    {
      type: "user" as typeof typeOptions[number],
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
          options: typeOptions
        }),

        // optimize runtime somehow
        // 1. return memo deps: [val, state.type] somehow :thinking:
        // 2. make sure that you return stable pointer... somehow...
        // 3. fix typings to inline objects instead of functions
        user_firstName: (val, state) => ({
          label: "first name: " + val,
          isActive: state.type === "user",
          minLen: 10,
          maxLen: 500
        }),

        user_lastName: (_val, state) => ({
          label: "last name",
          isActive: state.type === "user",
          minLen: 2,
          maxLen: 3
        }),

        company_name: (_val, state) => ({
          label: "company name",
          isActive: state.type === "company",
          minLen: 2,
          maxLen: 3
        }),

        company_address: (_val, state) => ({
          label: "company address",
          isActive: state.type === "company",
          minLen: 2,
          maxLen: 3
        })
      } as const
    },

    {
      user_firstName: {
        shouldChangeValue: (_value, _state, metadata) => {
          return metadata.label !== "first name: deadlock";
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
            {typeOptions.map(option => (
              <option key={option} value={option}>
                Option {option}
              </option>
            ))}

            <option value={"invalid-option"}>invalid option (not possible to pick)</option>
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

// -------------- custom rendering formio libarary --------------
const FormField = ({ ...field }: Field<string>) => {
  const hasErrors = field.errors.length > 0;

  return (
    <>
      <label style={{ color: hasErrors ? "red" : undefined }}>{field.metadata.label}</label>
      <input
        type="text"
        onChange={e => field.set(e.target.value)}
        value={field.value}
        style={{ borderColor: hasErrors ? "red" : undefined, boxShadow: "none" }}
      />

      <div style={{ color: "gray", fontSize: "0.8rem" }}>
        Used characters: {field.value.length} / Min:
        {field.metadata.minLen} / Max: {field.metadata.maxLen}
      </div>

      <div className="input-error">{field.errors.join(",")}</div>
    </>
  );
};
