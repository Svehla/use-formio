import * as React from 'react';
import { useFormio, Field } from '../../dist';
import { DEBUG_FormWrapper } from '../components';


/**
 * helper function to optimise re-render of React components
 */ 
export const debounce = <CB extends (...args: any[]) => any>(callback: CB, delay: number) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<CB>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay );
  }
}


export const DebouncedInput = () => {
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
          if (isValid) alert('form is valid')
        }}
      >
        <div>
          <label>Text with 1000ms debounce</label>
        </div>
        <MyTextArea {...f.text} />
        <div style={{color: 'red'}}>
          {f.text.errors.join(', ')}
        </div>
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  )
}

// this component si rendered only once per instance because set is stable pointer
const MyTextArea = React.memo((props: Field<string>) => {
  const debouncedSet = debounce(props.set, 1000)
  return (
    <input 
      type="text"
      onChange={(e) => debouncedSet(e.target.value)}
      onFocus={() => props.setErrors([])}
    />
  )
})
