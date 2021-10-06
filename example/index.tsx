import { isInteger, isRequired, maxLen } from "./validators";
import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useFormio } from '../.';
import {
  SyncValidations,
  InputConstrains,
  CrossValidations,
  SyncSetValuesBasedOnPrevValue,
  AsyncValidations,
  RevertToInitState,
} from './ExamplesReadme'

const styles = {
  redColor: { color: "red" }
}
const InputError = (props: { errors: string[]}) => (
  <div style={styles.redColor}>{props.errors.join(', ')}</div>
)
  
const App = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      age: "3",
      isHappy: true as boolean,
    },
    {
      firstName: {
        shouldChangeValue: maxLen(10),
        validator: async () => new Promise(res => setTimeout(res, 500)),
      },
      lastName: {
        shouldChangeValue: newValue => newValue.length <= 10,
        validator: (v, s) => [
          parseInt(s.age) > 30 ? isRequired(v) : undefined,
          ["john", "doe"].includes(v) ? "Fill real name please" : undefined,
        ],
      },
      age: {
        shouldChangeValue: v => v === "" || isInteger(v),
        validator: async value =>
          parseInt(value) <= 3 ? "app is only valid for users older than 3!" : undefined,
      },
    }
  );

  const f = form.fields;

  return (
    <div>
      <h1>useFormio</h1>

      <pre>{JSON.stringify(f, null, 2)}</pre>

      <form
        onSubmit={async e => {
          e.preventDefault();
          const [isValid, errors] = await form.validate();
          if (!isValid) {
            console.error(`Form is not valid, `, JSON.stringify(errors, null, 2));
          }
        }}
      >
        <div>
          <h3>First name</h3>
          <input
            value={f.firstName.value}
            type="text"
            onChange={async e => {
              f.firstName.set(e.target.value);
            }}
            disabled={f.firstName.isValidating}
            onBlur={() => f.firstName.validate()}
          />
          <InputError errors={f.firstName.errors} />
        </div>
        <div>
          <h3>Last name</h3>
          <input
            value={f.lastName.value}
            type="text"
            onChange={e => f.lastName.set(e.target.value)}
            onBlur={() => f.lastName.validate()}
          />
          <InputError errors={f.lastName.errors} />
        </div>
        <div>
          <h3>Age</h3>
          <input
            value={f.age.value}
            type="text"
            onChange={e => f.age.set(e.target.value)}
            onBlur={e => f.age.validate()}
          />
          <InputError errors={f.age.errors} />
        </div>

        <div>
          <h3>Is happy</h3>

          <button type="button" onClick={() => f.isHappy.set(p => !p)}>
            {f.isHappy.value ? "ano" : "ne"}
          </button>
        </div>

        <div>{form.isValidating && <h1>loading</h1>}</div>

        <button disabled={form.isValidating} type="submit">
          Submit
        </button>
      </form>


      <div>
        <h1>readme examples</h1>

        <div>
          <h2>SyncValidations</h2>
          <SyncValidations />
        </div>
        <div>
          <h2>InputConstrains</h2>
          <InputConstrains />
        </div>
        <div>
          <h2>CrossValidations</h2>
          <CrossValidations />
        </div>
        <div>
          <h2>SyncSetValuesBasedOnPrevValue</h2>
          <SyncSetValuesBasedOnPrevValue />
        </div>
        <div>
          <h2>AsyncValidations</h2>
          <AsyncValidations />
        </div>
        <div>
          <h2>RevertToInitState</h2>
          <RevertToInitState />
        </div>

      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));

