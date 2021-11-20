import * as React from 'react';
import { useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';

const isInteger = (val: string) => parseInt(val).toString() === val;
const maxLen = (maxLenSize: number) => (value: string) => value.length <= maxLenSize;

export const InputConstrains = () => {

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
          <div style={{ color: 'red' }}>
            {f.ID.errors.join(',')}
          </div>
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
          <div style={{ color: 'red' }}>
            {f.age.errors.join(',')}
          </div>
        </div>
        <button>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}