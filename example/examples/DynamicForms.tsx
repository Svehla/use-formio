import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useCombineFormio, useFormio } from "../../dist";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

export const DynamicForms = () => {
  const [formsKeys, setFormsKeys] = React.useState(["1", "2"]);
  const formsRefs = React.useRef<Record<string, any>>({});
  const forms = useCombineFormio(
    Object.fromEntries(Object.entries(formsRefs.current).map(([k, v]) => [k, v.current]))
  );

  return (
    <div>
      <form
        onSubmit={async e => {
          const combinedForms1 = forms;
          e.preventDefault();
          const [isValid] = await combinedForms1.validate();
          if (isValid) alert("form is valid");
        }}
      >
        {formsKeys.map(fKey => (
          <div key={fKey} className="row">
            <DynamicUserForm
              id={fKey}
              allocForm={fPointer => (formsRefs.current[fKey] = fPointer)}
              freeForm={() => delete formsRefs.current[fKey]}
              delete={() => setFormsKeys(p => p.filter(i => i !== fKey))}
              moveUp={() => setFormsKeys(p => [fKey, ...p.filter(i => i !== fKey)])}
              moveDown={() => setFormsKeys(p => [...p.filter(i => i !== fKey), fKey])}
            />
            <hr />
          </div>
        ))}
        <button onClick={() => setFormsKeys(p => [...p, Math.random().toString()])} type="button">
          add form
        </button>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

const DynamicUserForm = (props: {
  freeForm: () => void;
  allocForm: (pointer: any) => void;
  moveUp: () => void;
  moveDown: () => void;
  delete: () => void;
  id: string;
}) => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {},
    {
      firstName: { validator: isRequired },
      lastName: { validator: isRequired }
    }
  );
  const stableFormPointer = React.useRef<any>(null);

  stableFormPointer.current = form;

  React.useEffect(() => {
    props.allocForm(stableFormPointer);
    return () => props.freeForm();
  }, []);

  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <label>First name</label>
      <input
        type="text"
        onChange={e => f.firstName.set(e.target.value)}
        value={f.firstName.value}
        onBlur={() => f.firstName.validate()}
        disabled={f.firstName.isValidating}
      />
      <div className="input-error">{f.firstName.errors.join(",")}</div>
      <label>Last name</label>
      <input
        type="text"
        onChange={e => f.lastName.set(e.target.value)}
        value={f.lastName.value}
        onBlur={() => f.lastName.validate()}
        disabled={f.lastName.isValidating}
      />
      <div className="input-error">{f.lastName.errors.join(",")}</div>
      <button type="button" onClick={props.moveUp}>
        Move form to the start
      </button>
      <button type="button" onClick={props.moveDown}>
        Move form to the end
      </button>
      <button type="button" onClick={props.delete}>
        delete this form
      </button>
    </DEBUG_FormWrapper>
  );
};
