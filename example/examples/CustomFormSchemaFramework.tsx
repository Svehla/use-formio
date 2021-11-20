import * as React from "react";
import { DEBUG_FormWrapper } from "../components";
import { Field, useFormio } from "../../dist";

const isRequired = (value: string) => (value.trim() === "" ? "Field cannot be empty" : undefined);
const minNum = (min: number) => (value: number) =>
  value < min ? `amount has to be larger than ${min}` : undefined;
const hasToBeChecked = (value: boolean) =>
  value === false ? "value has to be checked" : undefined;

export const CustomFormSchemaFramework = () => {
  const form = useFormio(
    {
      firstName: "",
      secondName: "",
      lastName: "",
      description1: "",
      description2: "",
      description3: "",
      description4: "",
      description5: "",
      description6: "",
      description7: "",
      description8: "",
      amount: 0,
      verified: false,
      isOlder18: false,
      isHappy: false
    },
    {
      firstName: { validator: isRequired },
      lastName: { validator: isRequired },
      description1: { validator: isRequired },
      amount: { validator: minNum(100) },
      verified: { validator: hasToBeChecked }
    }
  );

  return (
    <DEBUG_FormWrapper form={form}>
      <UISchemaFormAbstraction
        form={form}
        fields={[
          {
            label: "First name!",
            key: "firstName"
          },
          {
            label: "Second name!",
            key: "secondName"
          },
          {
            label: "Last name!",
            key: "lastName"
          },
          {
            label: "Description 1",
            key: "description1"
          },
          {
            label: "Description 2",
            key: "description2"
          },
          {
            label: "Description 3",
            key: "description3"
          },
          {
            label: "Description 4",
            key: "description4"
          },
          {
            label: "Description 5",
            key: "description5"
          },
          {
            label: "Description 6",
            key: "description6"
          },
          {
            label: "Description 7",
            key: "description7"
          },
          {
            label: "Description 8",
            key: "description8"
          },
          {
            label: "Amount",
            key: "amount"
          },
          {
            label: "Verified",
            key: "verified"
          },
          {
            label: "Is older 18",
            key: "isOlder18"
          }
        ]}
        onSubmit={async ([isValid, _errors]) => {
          if (isValid) alert("form is valid");
        }}
      />
    </DEBUG_FormWrapper>
  );
};

// ------------ your custom UI framework library --------------

export type Await<T> = T extends Promise<infer U> ? U : T;

const UISchemaFormAbstraction = <T extends { fields: any; validate: any }>(props: {
  form: T;
  fields: { label: string; key: keyof T["fields"] }[];
  onSubmit: (arg: Await<ReturnType<T["validate"]>>) => void;
}) => {
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        props.onSubmit(await props.form.validate());
      }}
    >
      {props.fields.map(f => {
        const field = props.form.fields[f.key];
        const inputType = typeof field.value;

        return (
          <div key={f.key as any}>
            {inputType === "string" ? (
              <FTextInput label={f.label} {...field} />
            ) : inputType === "number" ? (
              <FNumberInput label={f.label} {...field} />
            ) : inputType === "boolean" ? (
              <FCheckbox label={f.label} {...field} />
            ) : (
              undefined
            )}
            <hr />
          </div>
        );
      })}
      <button>Submit</button>
    </form>
  );
};

// ---------------------------
// ---- component library ----

const FTextInput = React.memo((props: { label: string } & Field<string>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input value={props.value} type="text" onChange={e => props.set(e.target.value)} />
      </div>
      <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
    </div>
  );
});

const FNumberInput = React.memo((props: { label: string } & Field<number>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input
          value={props.value}
          type="number"
          onChange={e => props.set(parseFloat(e.target.value))}
        />
      </div>
      <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
    </div>
  );
});

const FCheckbox = React.memo((props: { label: string } & Field<boolean>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input type="checkbox" checked={props.value} onChange={e => props.set(e.target.checked)} />
      </div>
      <div style={{ color: "red" }}>{props.errors.join(", ")}</div>
    </div>
  );
});
