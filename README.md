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

## Examples

[you can find more examples on http://use-formio.svehlik.eu](http://use-formio.svehlik.eu)

```tsx
import * as React from "react";
import { useFormio } from "useFormio";

export const AsyncValidations = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: {
        validator: () =>
          new Promise(res =>
            setTimeout(() => {
              const error = Math.random() > 0.5 ? "Random error thrower" : undefined;
              res(error);
            }, 200)
          )
      },
      lastName: {
        validator: () =>
          new Promise(res =>
            setTimeout(() => {
              const error = Math.random() > 0.5 ? "Random error thrower" : undefined;
              res(error);
            }, 1000)
          )
      }
    }
  );
  const f = form.fields;

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        const [isValid] = await form.validate();
        if (isValid) alert("Successfully submitted");
      }}
    >
      <div>
        <button
          type="button"
          onClick={() => f.firstName.validate()}
          disabled={f.firstName.isValidating}
        >
          validate firstName {f.firstName.errors.join(",")}
        </button>
        <button
          type="button"
          onClick={() => f.lastName.validate()}
          disabled={f.lastName.isValidating}
        >
          validate lastName {f.firstName.errors.join(",")}
        </button>
      </div>

      <button type="submit" disabled={form.isValidating}>
        submit
      </button>
    </form>
  );
};
```

### Revert to init state

```tsx
import * as React from "react";
import { useFormio } from "useFormio";

export const RevertToInitState = () => {
  const form = useFormio(
    {
      firstName: "",
      lastName: ""
    },
    {
      firstName: {
        validator: v => (v === "XXX" ? "input cannot be XXX" : undefined)
      }
    }
  );
  const f = form.fields;

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        const [isValid] = await form.validate();
        if (!isValid) form.revertToInitState();
      }}
    >
      <input
        type="text"
        onChange={e => f.firstName.set(e.target.value)}
        value={f.firstName.value}
      />
      <input type="text" onChange={e => f.lastName.set(e.target.value)} value={f.lastName.value} />
      <button type="submit" disabled={form.isValidating}>
        submit
      </button>
    </form>
  );
};
```
