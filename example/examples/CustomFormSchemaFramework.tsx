import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { Field, getUseFormio } from "../../src";

const isRequired = (value: string) => (value.trim() === "" ? "Field is required" : undefined);
const minNum = (min: number) => (value: number) =>
  value < min ? "amount has to be larger than " + min : undefined;
const hasToBe = (finalValue: any) => (value: boolean) =>
  value !== finalValue ? "value has to be " + finalValue : undefined;

const fields = [
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
];

const useForm = getUseFormio(
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
    isOlder18: true,
    isHappy: false
  },
  {},
  {
    firstName: { validator: isRequired },
    lastName: { validator: isRequired },
    description1: { validator: isRequired },
    amount: { validator: minNum(100) },
    verified: { validator: hasToBe(true) },
    isOlder18: { validator: hasToBe(false) }
  }
);

export const CustomFormSchemaFramework = () => {
  const [result, setResult] = React.useState("");
  const form = useForm();

  return (
    <DEBUG_FormWrapper form={form}>
      <UISchemaFormAbstraction
        testIdPrefix="CustomFormSchemaFramework"
        form={form}
        fields={fields}
        onSubmit={([isValid, _errors]) => {
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
        result={result}
      />
    </DEBUG_FormWrapper>
  );
};

// ------------ your custom UI framework library --------------

const UISchemaFormAbstraction = (props: {
  form: { fields: any; validate: any };
  fields: { label: string; key: string }[];
  onSubmit: (arg: [boolean, any]) => void;
  testIdPrefix: string;
  result?: string;
}) => (
  <form
    onSubmit={async e => {
      e.preventDefault();
      props.onSubmit(await props.form.validate());
    }}
  >
    {props.fields.map(f => {
      const field = props.form.fields[f.key];
      const inputType = typeof field.value;
      const testId = `${props.testIdPrefix}-${f.key}`;

      return (
        <div key={f.key}>
          {inputType === "string" ? (
            <FTextInput testId={testId} label={f.label} {...field} />
          ) : inputType === "number" ? (
            <FNumberInput testId={testId} label={f.label} {...field} />
          ) : inputType === "boolean" ? (
            <FCheckbox testId={testId} label={f.label} {...field} />
          ) : undefined}
          <hr />
        </div>
      );
    })}
    <button type="submit" data-testid={`${props.testIdPrefix}-submit`}>
      Submit
    </button>
    <div data-testid={`${props.testIdPrefix}-result`}>{props.result}</div>
  </form>
);

// ---------------------------
// ---- component library ----

const FTextInput = React.memo((props: { label: string; testId: string } & Field<string>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input
          value={props.value}
          type="text"
          data-testid={`${props.testId}-input`}
          onChange={e => props.set(e.target.value)}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});

const FNumberInput = React.memo((props: { label: string; testId: string } & Field<number>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input
          value={props.value}
          type="number"
          data-testid={`${props.testId}-input`}
          onChange={e => props.set(parseFloat(e.target.value))}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});

const FCheckbox = React.memo((props: { label: string; testId: string } & Field<boolean>) => {
  return (
    <div>
      <label>{props.label}</label>
      <div>
        <input
          type="checkbox"
          data-testid={`${props.testId}-input`}
          checked={props.value}
          onChange={e => props.set(e.target.checked)}
        />
      </div>
      <div className="input-error" data-testid={`${props.testId}-errors`}>
        {props.errors.join(", ")}
      </div>
    </div>
  );
});
