import * as React from 'react';
import { DEBUG_FormWrapper } from '../components';
import { useFormio } from '../../dist';

export const AsyncValidations = () => {
  const form = useFormio(
    {
      firstName: '',
      lastName: '',
    },
    {
      firstName: {
        validator: () =>
          new Promise(res =>
            setTimeout(() => {
              const error =
                Math.random() > 0.5 ? 'Random error thrower' : undefined;
              res(error);
            }, 200)
          ),
      },
      lastName: {
        validator: () =>
          new Promise(res =>
            setTimeout(() => {
              const error =
                Math.random() > 0.5 ? 'Random error thrower' : undefined;
              res(error);
            }, 1000)
          ),
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
        <div>
          <div>
            <button
              type="button"
              onClick={() => f.firstName.validate()}
              disabled={f.firstName.isValidating}
            >
              validate firstName
            </button>
            <div style={{ color: 'red' }}>{f.firstName.errors.join(',')}</div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => f.lastName.validate()}
              disabled={f.lastName.isValidating}
            >
              validate lastName
            </button>
            <div style={{ color: 'red' }}>{f.lastName.errors.join(',')}</div>
          </div>
        </div>

        <button type="submit" disabled={form.isValidating}>
          Submit
        </button>
      </form>
    </DEBUG_FormWrapper>
  );
};
