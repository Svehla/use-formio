import * as React from 'react';
import { useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';

/**
 * demonstrate how to do that 1 input validations depends on value of another input
 * 
 * for dependencies between inputs we use second argument of validator callback which is `state`
 */
 export const CrossValidations = () => {
  const isInteger = (val: string) => parseInt(val).toString() === val;
  const form = useFormio(
    {
      parentID: "",
      age: "",
    },
    {
      parentID: {
         validator: (value, state) => {
           const isOlder18 = parseInt(state.age) < 18 
           if (isOlder18) return undefined
            return value.trim() === '' ? 'parent ID is required for people younger 18 years' : undefined
         }
      },
      age: {
        shouldChangeValue: isInteger
      },
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
        <div>
          <div>
            <label>parentID</label>
          </div>
          <input
            type='text'
            onChange={e => f.parentID.set(e.target.value)}
            value={f.parentID.value}
          />
          {f.parentID.errors.join(',')}
        </div>
        <div>
          <div>
            <label>age</label>
          </div>
          <input
            type='text'
            onChange={e => f.age.set(e.target.value)}
            value={f.age.value}
          />
          {f.age.errors.join(',')}
        </div>
        <button>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}