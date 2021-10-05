# use-formio

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
npm run use-formio
```

## use-cases

### Validations

```typescript
  const form = useFormio(
    {
      firstName: "",
      lastName: "",
    },
    {
			{
        validator: async () => new Promise(res => setTimeout(res, 500)),
      },
      lastName: {
        validator: (v, s) => [
          parseInt(s.age) > 30 ? isRequired(v) : undefined,
          ["john", "doe"].includes(v) ? "Fill real name please" : undefined,
        ],
      },
    }
  );

```

### Cross validations

### enable sub group input values

### async validations

### Combined form

### prev state callbacks

### Reusable input configuration

## Dynamic form fields limitations