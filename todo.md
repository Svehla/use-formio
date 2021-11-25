## TODO:

- rename to use-form-engine?
- dynamic inputs
- highlight that this library is for react only
- type inferring example
- splash screen (with logo, inferring + light example + description)
- screenshot/gif with type inferring

- ## add tests for:

  - validate on onTouch (after first inital validation has come)

- useWasFieldValidated

  - should I move this hook into the core use-formio library?
  - add tests

- add `meta` for option stable pointer to configure component like

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
