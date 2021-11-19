import * as React from 'react';
import { useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';
import { getRandomRGBLightColor } from './MultipleValidatorFunctions';

export const StableMethodPointers = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
    },
    {
      firstName: {
        validator: v => v === 'XXX' ? 'input cannot be XXX' : undefined
      }
    }
  );
  const f = form.fields

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        {/* thanks to stable pointer + React.memo, the component is rerendered only if value is changed */}
        <TextInput showRerendering label={'f.firstName'} {...f.firstName} />
        <TextInput showRerendering label={'f.lastName'} {...f.lastName} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}

type TextInputProps = { 
  label: string,
  validateOnBlur?: boolean
  showRerendering?: boolean

  // use-formio field interface
  value: string;
  errors: string[];
  isValidating: boolean;
  set: (userValue: string | ((prevState: string) => string)) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;
}

export const TextInput = React.memo((props: TextInputProps)=> {
  return (
    <div style={{ background: getRandomRGBLightColor() }}>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={e => props.set(e.target.value)}
      /> 
      {/* TODO: add global css classes */}
      <div style={{ color: 'red' }}>{props.errors.join(', ')}</div>
    </div>
  )
})