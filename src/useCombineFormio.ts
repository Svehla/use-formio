
type Await<T> = T extends Promise<infer U> ? U : T;

export const promiseAllObjectValues = async <T>(obj: T) => {
  const entriesObj = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );
  return Object.fromEntries(entriesObj) as { [K in keyof T]: Await<T[K]> };
};

export const mapObjectValues = <Key extends string, Value, NewValue>(
  fn: (value: Value, key: Key) => NewValue,
  obj: Record<Key, Value>
) =>
  Object.fromEntries(
    (Object.entries(obj) as [Key, Value][]).map(([key, value]) => [key, fn(value, key)], obj)
  ) as Record<Key, NewValue>;


export const useCombineFormio = <T extends Record<string, any>>(forms: T) => {

  const clearErrors = () => {
    return promiseAllObjectValues(mapObjectValues(v => v.clearErrors(), forms) as {
			[K in keyof T]: ReturnType<T[K]['clearErrors']>
		})
  }

  const revertToInitState = () => {
    return promiseAllObjectValues(mapObjectValues(v => v.revertToInitState(), forms) /*as {
			[K in keyof T]: ReturnType<T[K]['revertToInitState']>
		}*/)
  }

  const validate = async () => {
    const results = await promiseAllObjectValues(mapObjectValues((v) => v.validate(), forms) 
    /*as {
			[K in keyof T]: ReturnType<T[K]['validate']>
		}*/)

		const isValid = Object.values(results).map(([isValid]) => isValid).every(i => i)
    return [isValid, results] as const
  }

	const isValidating = Object.values(forms).map(i => i.isValidating).every(i => i)
	const isValid = Object.values(forms).map(i => i.isValid).every(i => i)

  return {
		isValidating,
		isValid,
    forms,
		revertToInitState,
    validate,
    clearErrors,
  }
}
