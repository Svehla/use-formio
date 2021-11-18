import { mapObjectValues } from '../src/useFormio';

describe('mapObjectValues', () => {
  it('check order 1', async () => {
		const data = {
			a: 'a',
			b: 'b',
			c: 'c',
		}

		const order = [] as string[]
		mapObjectValues(
			(_v, k) => {
				order.push(k)
			},
			data,
			{ stableKeyOrder: true }
		)

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('check order 2', async () => {
		const data = {
			c: 'c',
			b: 'b',
			a: 'a',
		}

		const order = [] as string[]
		mapObjectValues(
			(_v, k) => {
				order.push(k)
			},
			data,
			{ stableKeyOrder: true }
		)

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('stable order 3', async () => {
		const data = {
			b: 'b',
			a: 'a',
			c: 'c',
		}

		const order = [] as string[]
		mapObjectValues(
			(_v, k) => {
				order.push(k)
			},
			data,
			{ stableKeyOrder: true }
		)

    expect(order).toEqual(['a', 'b', 'c']);
  });

});