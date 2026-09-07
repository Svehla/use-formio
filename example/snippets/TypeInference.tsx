import { useFormio } from "../../src";

export const SignupForm = () => {
  const form = useFormio(
    { email: "", age: 0, newsletter: false },
    {},
    { age: { validator: age => (age < 18 ? "18+ only" : undefined) } }
  );
  const f = form.fields; // f.email: Field<string>, f.age: Field<number>, ...

  // @ts-expect-error  string is not assignable to boolean
  f.newsletter.set("yes");

  return <input value={f.email.value} onChange={e => f.email.set(e.target.value)} />;
};
