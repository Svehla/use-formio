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
          <MyTextInput
            label={'First Name'}
            {...f.firstName}
          />

        </div>
        <div>
          <MyTextInput
            label={'Last Name'}
            {...f.lastName}
          />
        </div>
        <div>
          <MyTextInput
            label={'Age'}
            {...f.age}
          />
        </div>

        <div>
          <MyBoolInput
            errors={form.fields.isHappy.errors}
            label="is happy"
            set={f.isHappy.set}
            value={f.isHappy.value} 
          />
          
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

type MyTextInputProps = { 
  label: string,
  value: string;
  errors: string[];
  isValidating: boolean;
  set: (userValue: string | ((prevState: string) => string)) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;
}

const MyTextInput = React.memo((props: MyTextInputProps)=> {
  console.log(`rerender label input ${props.label}`)

  return (
    <div>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={e => props.set(e.target.value)}
        // onChange={onChange}
        onBlur={() => props.validate()}
      /> 
      <InputError errors={props.errors} />
    </div>
  )
})

type MyBoolInputProps = { 
  label: string,
  value: boolean,
  set: (prevCb: (p: boolean) => boolean) => void, 
  errors: string[],
}

const MyBoolInput = React.memo((props: MyBoolInputProps)=> {
  console.log(`rerender boolean input ${props.label}`)

  return (
    <div>
      <h3>{props.label}</h3>


      <button type="button" onClick={() => props.set(p => !p)}>
        {props.value ? "ano" : "ne"}
      </button>
      <InputError errors={props.errors} />

    </div>
  )
})


ReactDOM.render(<App />, document.getElementById('root'));

