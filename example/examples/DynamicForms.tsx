import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useCombineFormio, useFormio } from "../../dist";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

// useCombineFormio is not hook!!!! (at the moment) xd
const combineFormio = useCombineFormio;

export const DynamicForms = () => {
  const [formsKeys, setFormsKeys] = React.useState(["1", "2"]);
  const formsRefs = React.useRef<Record<string, any>>({});

  return (
    <div>
      <form
        onSubmit={async e => {
          const combinedForms1 = combineFormio(
            Object.fromEntries(Object.entries(formsRefs.current).map(([k, v]) => [k, v.current]))
          );
          e.preventDefault();
          const [isValid] = await combinedForms1.validate();
          if (isValid) alert("form is valid");
        }}
      >
        {formsKeys.map(fKey => (
          <div key={fKey} className="row">
            <Dyn1
              id={fKey}
              getFormPointer={fPointer => (formsRefs.current[fKey] = fPointer)}
              removeFormPointer={() => delete formsRefs.current[fKey]}
              deleteForm={() => setFormsKeys(p => p.filter(i => i !== fKey))}
              changeOrderUp={() => setFormsKeys(p => [fKey, ...p.filter(i => i !== fKey)])}
              changeOrderDown={() => setFormsKeys(p => [...p.filter(i => i !== fKey), fKey])}
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

const Dyn1 = (props: {
  deleteForm: any;
  removeFormPointer: () => void;
  getFormPointer: (p: any) => void;
  changeOrderUp: () => void;
  changeOrderDown: () => void;
  id: string;
}) => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: { validator: isRequired },
      lastName: { validator: isRequired }
    }
  );
  const stableFormPointer = React.useRef<any>(null);

  stableFormPointer.current = form;

  React.useEffect(() => {
    props.getFormPointer(stableFormPointer);
    return () => props.removeFormPointer();
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
      <button type="button" onClick={props.changeOrderUp}>
        Move form to the start
      </button>
      <button type="button" onClick={props.changeOrderDown}>
        Move form to the end
      </button>
      <button type="button" onClick={props.deleteForm}>
        delete this form
      </button>
    </DEBUG_FormWrapper>
  );
};
