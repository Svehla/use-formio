import * as React from 'react';
import { useFormio } from '../dist';

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------

export const SyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
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
      }
    }
  );
  const f = form.fields

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        const [isValid] = await form.validate()
        alert(isValid)
      }}
    >
      <input
        type='text'
        onChange={e => f.firstName.set(e.target.value)}
        value={f.firstName.value}
      />
      {f.firstName.errors.join(',')}
      <input
        type='text'
        onChange={e => f.lastName.set(e.target.value)}
        value={f.lastName.value}
      />
      {f.lastName.errors.join(',')}
      <button>submit</button>
    </form>
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
    <form
      onSubmit={async e => e.preventDefault()}
    >
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
    <form
      onSubmit={async e => e.preventDefault()}
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
    <div>
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
    </div>
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
    <form
      onSubmit={async e => {
        e.preventDefault()
        const [isValid] = await form.validate()
        if (isValid) alert('Successfully submitted')
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
    <form
      onSubmit={async e => {
        e.preventDefault()
        const [isValid] = await form.validate()
        // if form is not valid, reset data
        if (!isValid) { 
          form.revertToInitState()
        }
      }}
    >
      <input
        type='text'
        onChange={e => f.firstName.set(e.target.value)}
        value={f.firstName.value}
      />
      <input
        type='text'
        onChange={e => f.lastName.set(e.target.value)}
        value={f.lastName.value}
      />
      <button disabled={form.isValidating}>Submit</button>
  </form>
  )
}