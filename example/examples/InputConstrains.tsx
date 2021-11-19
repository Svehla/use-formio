import * as React from 'react';
import { useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';

export const InputConstrains = () => {
  const isInteger = (val: string) => parseInt(val).toString() === val;
  const maxLen = (maxLenSize: number) => (value: string) => value.length <= maxLenSize;

  const form = useFormio(
    {
      ID: "",
      age: "",
    },
    {
      ID: {
        shouldChangeValue: maxLen(10)
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
            <label>ID</label>
          </div>
          <input
            type='text'
            onChange={e => f.ID.set(e.target.value)}
            value={f.ID.value}
          />
          {f.ID.errors.join(',')}
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