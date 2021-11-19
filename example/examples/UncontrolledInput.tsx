import * as React from 'react';
import {  useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';
import { debounce } from '../utils';

export const UncontrolledInput = () => {
  const form = useFormio(
    {
      text: "",
    },
    {
      text: {
        validator: v => v.length < 200 ? 'LENGTH SHOULD BE >= 200' : undefined
      }
    }
  )
  const f = form.fields

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          // if form is not valid, reset data
          if (isValid) alert('form is valid')
        }}
      >
        <div>
          <label>Text with 400ms debounce</label>
        </div>
        <MyTextArea
          set={f.text.set}
        />
        <div style={{color: 'red'}}>{f.text.errors.join(', ')}</div>
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}

// this component si rendered only once per instance because set is stable pointer
const MyTextArea = React.memo((props: {
  set: (userValue: string | ((prevState: string) => string)) => void 
}) => {
  return (
    <textarea 
      onChange={(e) => debounce(props.set, 400)(e.target.value)}
    />
  )
})
