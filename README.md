# [use-formio](http://use-formio.svehlik.eu)


[Online interactive documentation is availabe on http://use-formio.svehlik.eu](http://use-formio.svehlik.eu)


`use-formio` has 0 dependencies and less than 200 lines of code!

This minimalistic approche brings you proper level of abstraction to abstract heavy lifting form boilerplate React code.

Each of your application deserves custom UI solution so it does not make sense to use separate library to handle form UIs.

If your application needs to have tons of forms is really easy for programmers to make custom form configurable UI.

In useFormio you just define custom business model and don't waste a time with boilerplate around.

At the top of this, useFormio package is different from the others with the uniqeu support of Typescript type inferring.

You can write a huge form without writing any line of Typescript static types.
Thanks to smart API we're able to infer static types and keep code clean and safe without runtime-errors.

## installation

```sh
npm install use-formio
```

## use-cases

### Sync validations

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

const validate3 = (val: string) => val.includes('3')
  ? 'you cannot write three into the input'
  : undefined
const isInteger = (val: string) => parseInt(val).toString() === val ? undefined : 'only int is valid input';
const maxLen10 = (val: string) => val.length > 10 ? 'max len is 10' : undefined
const minLen4 = (val: string) => val.length < 4 ? 'min len is 4' : undefined

export const SyncValidations = () => {
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
    <form
      onSubmit={async e => {
        e.preventDefault()
        const [isValid] = await form.validate()
        alert(isValid)
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
  )
}
```

### Input constrains

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

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
    </form>
  )
}
```

### Cross validations

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

const isInteger = (val: string) => parseInt(val).toString() === val;

/**
 * demonstrate how to do that 1 input validations depends on value of another input
 * 
 * for dependencies between inputs we use second argument of validator callback which is `state`
 */
export const CrossValidations = () => {
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
    </form>
  )
}
```

### Sync set form value based on previous state

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

/**
 * set values synchronously from your JS function via prevState callbacks
 */
export const SyncSetValueBasedOnPrevValue = () => {
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
  )
}
```

### Async validations

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

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

      <button 
        type="submit"
        disabled={form.isValidating}
      >
        submit
      </button>
    </form>
  )
}
```

### Revert to init state

```tsx
import * as React from 'react';
import { useFormio } from 'useFormio';

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
      <button 
        type="submit"
        disabled={form.isValidating}
      >
        submit
      </button>
  </form>
  )
}
```

### Multiple Validator functions

### Reusable input configuration

## Dynamic form fields limitations