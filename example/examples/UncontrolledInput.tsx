import * as React from 'react';
import {  useFormio } from '../../dist';
import { DEBUG_FormWrapper } from '../components';

const MIN_TEXTAREA_LENGTH = 50
export const UncontrolledInput = () => {
  const textareaRef = React.useRef<any>(undefined)
  const form = useFormio(
    {
      text: "",
    },
    {
      text: {
        validator: v => v.length < MIN_TEXTAREA_LENGTH ? `LENGTH SHOULD BE >= ${MIN_TEXTAREA_LENGTH}` : undefined
      }
    }
  )
  const f = form.fields

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          const textareaValue = textareaRef.current
          e.preventDefault()
          const [isValid] = await form.validate()
          // if form is not valid, reset data
          if (isValid) alert('form is valid')
        }}
      >
        <div>
          <label>Text</label>
        </div>

        <textarea 
          ref={textareaRef}
          onFocus={() => f.text.setErrors([])}
          onBlur={() => f.text.set(textareaRef.current.value)}
        />

        <div style={{color: 'red'}}>{f.text.errors.join(', ')}</div>
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}