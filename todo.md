## TODO:

- rename to use-form-engine?
- type inferring example
- splash screen (with logo, inferring + light example + description)
- screenshot/gif with type inferring
- TODO: should i memoize all levels of objects??? :thinking-face:
- TODO: should i memoize useFormValues

- ## add tests for:
  - add tests for memozied form.validate()

* add `meta` for option stable pointer to configure component like

```js
validator: xxx;
shouldChangeValue: yyy;
// Custom meta information
meta: {
  type: "number";
  maxLen: 10;
}
```

add pointers to check value by your own for uncontrolled inputs
`static_shouldChangeValue: shouldChangeValue`

```ts
React.useEffect(() => {
  if (field.isValidating === true) setWasValidated(true);
}, [field.isValidating]);

vs;

React.useEffect(() => {
  setWasValidated(true);
}, [field.isValidating]);
```

if I'll do sync validations onchange validation hook will stops to work

getUseFormio

- make possible to parametrize default valueI => or we can use just:
- useComponentDidMount(() => f.firstName.set('x'))

validate()
// check if all validators are sync/async (check if they are returning Promise)
// if field validator is not returning promise then do sync validation and do not change
// isValidating to make React.memo works correctly
