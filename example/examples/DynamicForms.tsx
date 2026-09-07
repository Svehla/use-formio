import * as React from "react";
import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";
import { useCombineFormio, useFormio } from "../../src";

export const isRequired = (value: string) =>
  value.trim() === "" ? "Field is required" : undefined;

export const DynamicForms = () => {
  const [result, setResult] = React.useState("");
  const [formsKeys, setFormsKeys] = React.useState(["1", "2"]);

  /**
   * Every sub-form registers a *stable ref* to itself here from its own `useEffect`.
   *
   * The registry has to live in `useState`, not in a `useRef`: a ref mutation does not re-render
   * the parent, so `useCombineFormio` would have been built from an empty registry on the first
   * render - and combining zero forms is vacuously valid, which made the very first submit of a
   * completely empty form report "form is valid". Child effects run before the parent's, so with
   * a state registry the parent is re-rendered with every sub-form before the page is painted.
   *
   * What is stored is the ref, not the form itself, so that reading `.current` during the parent
   * render always yields the sub-form's *latest* `isValid` / `isValidating` values.
   */
  const [formsRefs, setFormsRefs] = React.useState<Record<string, any>>({});
  const forms = useCombineFormio(
    Object.fromEntries(Object.entries(formsRefs).map(([k, v]) => [k, v.current]))
  );

  return (
    <div>
      <form
        onSubmit={async e => {
          const combinedForms1 = forms;
          e.preventDefault();
          const [isValid] = await combinedForms1.validate();
          setResult(isValid ? "form is valid" : "form is invalid");
        }}
      >
        {formsKeys.map(fKey => (
          <div key={fKey} className="row">
            <DynamicUserForm
              id={fKey}
              allocForm={fPointer => setFormsRefs(p => ({ ...p, [fKey]: fPointer }))}
              freeForm={() =>
                setFormsRefs(p => {
                  if (!(fKey in p)) return p;
                  const next = { ...p };
                  delete next[fKey];
                  return next;
                })
              }
              delete={() => setFormsKeys(p => p.filter(i => i !== fKey))}
              moveUp={() => setFormsKeys(p => [fKey, ...p.filter(i => i !== fKey)])}
              moveDown={() => setFormsKeys(p => [...p.filter(i => i !== fKey), fKey])}
            />
            <hr />
          </div>
        ))}
        <button
          onClick={() => setFormsKeys(p => [...p, Math.random().toString()])}
          type="button"
          data-testid="DynamicForms-add-form"
        >
          add form
        </button>

        <button type="submit" data-testid="DynamicForms-submit">
          Submit
        </button>
        <div data-testid="DynamicForms-result">{result}</div>
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
  const testId = `DynamicForms-${props.id}`;

  return (
    <DEBUG_FormWrapper form={form}>
      <label>First name</label>
      <input
        type="text"
        data-testid={`${testId}-firstName-input`}
        onChange={e => f.firstName.set(e.target.value)}
        value={f.firstName.value}
        onBlur={() => f.firstName.validate()}
        disabled={f.firstName.isValidating}
      />
      <div className="input-error" data-testid={`${testId}-firstName-errors`}>
        {f.firstName.errors.join(",")}
      </div>
      <label>Last name</label>
      <input
        type="text"
        data-testid={`${testId}-lastName-input`}
        onChange={e => f.lastName.set(e.target.value)}
        value={f.lastName.value}
        onBlur={() => f.lastName.validate()}
        disabled={f.lastName.isValidating}
      />
      <div className="input-error" data-testid={`${testId}-lastName-errors`}>
        {f.lastName.errors.join(",")}
      </div>
      <button type="button" onClick={props.moveUp} data-testid={`${testId}-move-up`}>
        Move form to the start
      </button>
      <button type="button" onClick={props.moveDown} data-testid={`${testId}-move-down`}>
        Move form to the end
      </button>
      <button type="button" onClick={props.delete} data-testid={`${testId}-delete`}>
        delete this form
      </button>
    </DEBUG_FormWrapper>
  );
};
