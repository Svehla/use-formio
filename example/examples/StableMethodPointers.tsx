import * as React from 'react';
import { DEBUG_FormWrapper } from '../components';
import { Field } from '../../dist';
import { useFormio } from '../../dist';

const getRandomRGBLightColor = () => {
  return `rgb(${[
    150 + Math.random() * 100,
    150 + Math.random() * 100,
    150 + Math.random() * 100,
  ].join(',')})`;
};

export const StableMethodPointers = () => {
  const form = useFormio(
    {
      firstName: '',
      lastName: '',
    },
    {
      firstName: {
        validator: v => (v === 'XXX' ? 'input cannot be XXX' : undefined),
      },
    }
  );
  const f = form.fields;

  return (
    <DEBUG_FormWrapper form={form}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          const [isValid] = await form.validate();
          if (isValid) alert('form is valid');
        }}
      >
        {/* thanks to stable pointer + React.memo, the component is rerendered only if value is changed */}
        <TextInput
          label={'f.firstName'}
          value={f.firstName.value}
          set={f.firstName.set}
          errors={f.firstName.errors}
        />
        <TextInput
          label={'f.lastName'}
          value={f.lastName.value}
          set={f.lastName.set}
          errors={f.lastName.errors}
        />
        <button disabled={form.isValidating}>Submit</button>
      </form>
    </DEBUG_FormWrapper>
  );
};

type TextField = Field<string>;
type TextInputProps = {
  label: string;
  validateOnBlur?: boolean;

  value: TextField['value'];
  set: TextField['set'];
  errors: TextField['errors'];
};

const TextInput = React.memo((props: TextInputProps) => {
  return (
    <div style={{ background: getRandomRGBLightColor() }}>
      <h3>{props.label}</h3>
      <input
        value={props.value}
        type="text"
        onChange={e => props.set(e.target.value)}
      />
      <div style={{ color: 'red' }}>{props.errors.join(', ')}</div>
    </div>
  );
});
