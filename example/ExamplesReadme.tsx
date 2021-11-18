import { useCallback } from 'react';
import * as React from 'react';
import { useCombineFormio, useFormio } from '../dist';
import { isInteger, isRequired, maxLen } from "./validators";

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------
export const SyncValidations = () => {
  const validate3 = (val: string) => val.includes('3')
    ? 'you cannot write `3` into the input'
    : undefined
  const isInteger = (val: string) => parseInt(val).toString() === val ? undefined : 'only int is valid input';
  const maxLen10 = (val: string) => val.length > 10 ? 'max len is 10' : undefined
  const minLen4 = (val: string) => val.length < 4 ? 'min len is 4' : undefined

  const form = useFormio(
    {
      firstName: "",
      lastName: "",
      randomInt: "",
    },
    {
      firstName: {
        validator: value => value.trim() === '' ? `Input can't be empty` : undefined
      },
      lastName: {
        // validator can return an array of errors
        validator: value => {

          const err1 = value.includes(' ')
            ? 'last name can not include a space'
            : undefined

          const err2 = value.length > 20
            ? 'Max size of last name is 20 characters'
            : undefined

          return [err1, err2]
        }
      },
      randomInt: {
        validator: value => [
          validate3,
          isInteger,
          maxLen10,
          minLen4,
        ].map(fn => fn(value))
      },
    }
  );
  const f = form.fields

  return (
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          alert('form is valid: ' + isValid)
        }}
      >
        <div>
          <input
            type='text'
            onChange={e => f.firstName.set(e.target.value)}
            value={f.firstName.value}
          />
          {f.firstName.errors.join(',')}
        </div>
        <div>
          <input
            type='text'
            onChange={e => f.randomInt.set(e.target.value)}
            value={f.randomInt.value}
          />
          {f.randomInt.errors.join(',')}
        </div>
        <div>
          <input
            type='text'
            onChange={e => f.lastName.set(e.target.value)}
            value={f.lastName.value}
          />
          {f.lastName.errors.join(',')}
        </div>
        <button>submit</button>
      </form>
    </FormWrapper>
  )
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

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
    <FormWrapper form={form}>
      <form onSubmit={async e => e.preventDefault()}>
        <div>
          <input
            type='text'
            onChange={e => f.ID.set(e.target.value)}
            value={f.ID.value}
          />
          {f.ID.errors.join(',')}
        </div>
        <div>
          <input
            type='text'
            onChange={e => f.age.set(e.target.value)}
            value={f.age.value}
          />
          {f.age.errors.join(',')}
        </div>
        <button>Submit</button>
      </form>
    </FormWrapper>
  )
}


// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

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
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        <div>
          <input
            type='text'
            onChange={e => f.parentID.set(e.target.value)}
            value={f.parentID.value}
          />
          {f.parentID.errors.join(',')}
        </div>
        <div>
          <input
            type='text'
            onChange={e => f.age.set(e.target.value)}
            value={f.age.value}
          />
          {f.age.errors.join(',')}
        </div>
        <button>Submit</button>
      </form>
    </FormWrapper>
  )
}


// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

/**
 * set values synchronously from your JS function via prevState callbacks
 */
 export const SyncSetValuesBasedOnPrevValue = () => {
  const form = useFormio(
    {
      ID: "",
      amount: 0,
    },
    {
      ID: {
        validator: value => value === 'xxx' ? `ID cannot has value '${value}'` : undefined
      },
      amount: {
        validator: value => value === 5 ? `ID cannot has value '${value}'` : undefined
      },
    }
  );
  const f = form.fields

  return (
    <FormWrapper form={form}>
      <button
        onClick={async () => {
          f.ID.set('x')
          f.ID.set(p => `${p}x`)
          f.ID.set(p => `${p}x`)
          // f.ID has value: 'xxx`
          f.amount.set(0)
          f.amount.set(p => p + 1)
          f.amount.set(p => p + 4)
          // f.amount has value 5
          const [isValid, errors] = await form.validate()
          if (isValid) return
          if (errors.ID.length > 0) {
            alert('there is problem with ID field')
          }
          if (errors.amount.length > 0) {
            alert('there is problem with ID amount')
          }
        }}
      >Submit</button>
    </FormWrapper>
  )
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

 export const AsyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
    },
    {
      firstName: {
        validator: () => new Promise(res => 
          setTimeout(() => {
            const error = Math.random() > 0.5 ? 'Random error thrower' : undefined
            res(error)
          }, 200)
        )
      },
      lastName: {
        validator: () => new Promise(res => 
          setTimeout(() => {
            const error = Math.random() > 0.5 ? 'Random error thrower' : undefined
            res(error)
          }, 1000)
        )
      },
    }
  );
  const f = form.fields

  return (
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => f.firstName.validate()}
            disabled={f.firstName.isValidating}
          >
            validate firstName {f.firstName.errors.join(',')}
          </button>
          <button
            type="button"
            onClick={() => f.lastName.validate()}
            disabled={f.lastName.isValidating}
          >
            validate lastName {f.firstName.errors.join(',')}
          </button>
        </div>

        <button type="submit" disabled={form.isValidating}>Submit</button>
      </form>
    </FormWrapper>

  )
}


// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

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
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        {/* thanks to stable pointer + React.memo, the component is rerendered only if value is changed */}
        <MyTextInput label={'f.firstName'} {...f.firstName} />
        <MyTextInput label={'f.lastName'} {...f.lastName} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </FormWrapper>
  )
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

export const RevertToInitState = () => {
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
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          await form.revertToInitState()
          
        }}
      >
        <MyTextInput label={'f.firstName'} {...f.firstName} />
        <MyTextInput label={'f.lastName'} {...f.lastName} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </FormWrapper>
  )
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

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
    <FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          const [isValid] = await form.validate()
          if (isValid) alert('form is valid')
        }}
      >
        <MyTextInput label={'f.firstName'} {...f.firstName} />
        <MyTextInput label={'f.lastName'} {...f.lastName} />
        <MyTextInput label={'f.age'} {...f.age} />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </FormWrapper>
  )
}



// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

export const UseCombineFormioExample = () => {
  const form = useCombineFormio({
    a: useFormio(
      {
        firstName: "",
        lastName: "",
      },
      {
        firstName: {
          validator: v => v === 'XXX' ? 'input cannot be XXX' : undefined
        }
      }
    ),
    b: useFormio(
      {
        age: "",
        id: "",
      },
    )
  })

  const a = form.forms.a.fields
  const b = form.forms.b.fields

  return (
    <FormWrapper form={form.forms.a}>
      <FormWrapper form={form.forms.b}>
        <form
          onSubmit={async e => {
            e.preventDefault()
            const [isValid] = await form.validate()
            // if form is not valid, reset data
            if (isValid) alert('form is valid')
          }}
        >
          <MyTextInput label="a.firstName" {...a.firstName} />
          <MyTextInput label="a.lastName" {...a.lastName} />
          <MyTextInput label="b.age" {...b.age} />
          <MyTextInput label="b.id" {...b.id} />
          <button disabled={form.isValidating}>Submit</button>
        </form>
      </FormWrapper>
    </FormWrapper>
  )
}

// -------------------------------------------
// ------- my custom component system --------
  
const styles = {
  formWrapper: {
    display: 'flex',
    alignItems: 'flex-start'
  },
  redColor: {
    color: "red" 
  },
  formWrapperForm: {
    marginRight: '3rem'
  }
}

const FormWrapper = (props: any) => {
  const copy = props.form
  delete copy.__dangerous

  return (
    <div style={styles.formWrapper}>
      <div style={styles.formWrapperForm}>
        {props.children}
      </div>
      <pre>{JSON.stringify(copy, null, 2)}</pre>
    </div>
  )
}

const InputError = (props: { errors: string[]}) => (
  <div style={styles.redColor}>{props.errors.join(', ')}</div>
)

type MyTextInputProps = { 
  label: string,
  validateOnBlur?: boolean

  value: string;
  errors: string[];
  isValidating: boolean;
  set: (userValue: string) => void;
  validate: () => Promise<[boolean, string[]]>;
  setErrors: (newErrors: string[] | ((prevState: string[]) => string[])) => void;

}

const MyTextInput = React.memo((props: MyTextInputProps)=> {
  console.log(`rerender label input ${props.label}`)

  const onChange = useCallback((e: any) => props.set(e.target.value), [])
  const onBlur = React.useMemo(() => props.validateOnBlur ? () => props.validate() : undefined, [props.validateOnBlur])

  const getRandomColor = () => {
    return `rgb(${[
      150 + Math.random() * 100,
      150 + Math.random() * 100,
      150 + Math.random() * 100 
    ].join(',')})`
  }

  return (
    <div style={{ background: getRandomColor() }}>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        disabled={props.isValidating}
        onChange={onChange}
        onBlur={onBlur}
      /> 
      <InputError errors={props.errors} />
    </div>
  )
})