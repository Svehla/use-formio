import * as React from 'react';
import { Field, useCombineFormio, useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';

export const isRequired = (value: string) => value.trim() === '' ? 'Field cannot be empty' : undefined;

export const UseCombineFormioExample = () => {
  const form = useCombineFormio({
    a: useFormio(
      {
        firstName: "",
        lastName: "",
      },
      {
        firstName: {
          validator: isRequired
        },
        lastName: {
          validator: isRequired
        }
      }
    ),
    b: useFormio(
      {
        age: "",
        id: "",
      },
      {
        age: {
          validator: isRequired
        },
        id: {
          validator: isRequired
        }
      }
    )
  })

  const a = form.forms.a.fields
  const b = form.forms.b.fields

  return (
    <DEBUG_FormWrapper form={form.forms.a} form2={form.forms.b}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        <TextInput label="a.firstName" {...a.firstName} />
        <TextInput label="a.lastName" {...a.lastName} />
        <TextInput label="b.age" {...b.age} />
        <TextInput label="b.id" {...b.id} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}

type TextInputProps = { 
  label: string,
  validateOnBlur?: boolean
  showRerendering?: boolean
} & Field<string>

const TextInput = React.memo((props: TextInputProps)=> {
  return (
    <div>
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