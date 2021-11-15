import { useFormio } from '../src/useFormio';
import { renderHook, act } from '@testing-library/react-hooks';

describe('it', () => {
  it('set string value', async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: 'str1',
      })
    );
    await act(async () => {
      result.current.fields.str1.set(p => `${p}_`);
      result.current.fields.str1.set(p => `${p}x`);
      result.current.fields.str1.set(p => `${p}x`);
    });
    expect(result.current.fields.str1.value).toBe('str1_xx');
  });

  it('string value custom validator', async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: 'str1',
        },
        {
          str1: {
            validator: v => (v === 'xxx' ? 'ERR' : undefined),
          },
        }
      )
    );
    await act(async () => {
      result.current.fields.str1.set(p => `${p}x`);
      result.current.fields.str1.set('xxx');
      await result.current.fields.str1.validate();
    });
    expect(result.current.fields.str1.value).toBe('xxx');
    expect(result.current.fields.str1.errors).toEqual(['ERR']);
  });

  it('set form errors', async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: 'str1',
        str2: 'str1',
      })
    );
    await act(async () => {
      result.current.fields.str1.setErrors(['1']);
      result.current.fields.str2.setErrors(['2']);
    });
    expect(result.current.fields.str1.errors).toEqual(['1']);
    expect(result.current.fields.str2.errors).toEqual(['2']);
  });

  it('clear errors', async () => {
    const { result } = renderHook(() =>
      useFormio({
        str1: 'str1',
        str2: 'str1',
        str3: 'str1',
        str4: 'str1',
      })
    );
    await act(async () => {
      result.current.fields.str1.setErrors(['1']);
      result.current.fields.str2.setErrors(['2']);
      await result.current.clearErrors();
    });
    expect(result.current.fields.str1.errors).toEqual([]);
    expect(result.current.fields.str2.errors).toEqual([]);
  });

  it('cross validations', async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: 'str1',
          str2: 'str2',
        },
        {
          str1: {
            validator: (v, state) =>
              state.str2 === 'xxx' && v === 'xxx' ? 'ERR' : undefined,
          },
        }
      )
    );
    await act(async () => {
      result.current.fields.str1.set('xxx');
      result.current.fields.str2.set('xxx');
      await result.current.validate();
    });
    expect(result.current.fields.str1.errors).toEqual(['ERR']);
  });

  it('success async validations', async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: 'str1',
        },
        {
          str1: {
            validator: () => Promise.resolve(undefined),
          },
        }
      )
    );
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.str1.errors).toEqual([]);
  });

  it('unsuccess async validations', async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: 'str1',
        },
        {
          str1: {
            validator: () => Promise.resolve(['ERR']),
          },
        }
      )
    );
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.fields.str1.errors).toEqual(['ERR']);
  });

  it('unsuccess async validations', async () => {
    const { result } = renderHook(() =>
      useFormio(
        {
          str1: 'str1',
        },
        {
          str1: {
            validator: () => Promise.resolve(['ERR']),
          },
        }
      )
    );
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.isValid).toEqual(false);
  });
});
