import { useCallback } from 'react';
import * as React from 'react';
import { useFormio } from '../../dist';
import { isInteger, isRequired, maxLen } from "../validators";
import { DEBUG_FormWrapper } from '../components';

export const MultipleValidatorFunctions = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      age: ""
    },
    {
      firstName: {
        validator: v => v === 'XXX' ? 'input cannot be XXX' : undefined
      },
      lastName: {
        validator: isRequired,
        shouldChangeValue: maxLen(30)
      },
      age: {
        shouldChangeValue: v => v.length === 0 ? true : isInteger(v) && maxLen(2)(v)
        
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
        <TextInput label={'f.firstName'} {...f.firstName} />
        <TextInput label={'f.lastName'} {...f.lastName} />
        <TextInput label={'f.age'} {...f.age} />
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


export const getRandomRGBLightColor = () => {
  return `rgb(${[
    150 + Math.random() * 100,
    150 + Math.random() * 100,
    150 + Math.random() * 100 
  ].join(',')})`
}

export const TextInput = React.memo((props: TextInputProps)=> {
  console.log(`rerender label input ${props.label}`)

  const onChange = useCallback((e: any) => props.set(e.target.value), [])
  const onBlur = React.useMemo(() => props.validateOnBlur ? () => props.validate() : undefined, [props.validateOnBlur])

  return (
    <div style={props.showRerendering ? { background: getRandomRGBLightColor() } : undefined}>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={onChange}
        onBlur={onBlur}
      /> 
			<div style={{ color: 'red' }}>{props.errors.join(', ')}</div>
    </div>
  )
})