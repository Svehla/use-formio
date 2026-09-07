#!/usr/bin/env bash
#
# Packs the library exactly as it would be published and installs that tarball into throwaway
# consumer projects, the way a real user would. It answers one question: can somebody on
# use-formio@1 bump `react` and `use-formio` and keep working?
#
# What it checks (fast, no browser, no docs site):
#   1. `npm run build` + `npm pack`                 - the artifact that would be published
#   2. `publint` + `@arethetypeswrong/cli --pack .` - packaging / types-resolution lint
#   3. cjs-node   - `require("use-formio")` + `react-dom/server` renderToString  (CJS entry + SSR)
#   4. esm-node   - `import ... from "use-formio"` in a `"type": "module"` package (ESM entry + SSR)
#   5. ts-node16  - `tsc --noEmit` under `moduleResolution: node16`, strict, consuming the types
#                   through BOTH `import` and `import = require`, incl. every public type export
#   6. react17    - the peer dependency really does refuse React 17, and the runtime error a user
#                   sees if they force past it is the documented one
#
# The browser / RTL / 18-example side of the verification is not in here on purpose: it needs a
# checkout of the 1.0.6 examples and a real Chrome. See `npm run test:react-matrix` for the
# React-version matrix over the library's own test suite.
#
# usage: npm run verify:consumer
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${TMPDIR:-/tmp}"
WORKDIR="${TMP%/}/use-formio-verify-consumer"
# the default ~/.npm/_cacache is not always writable (sandboxes / CI images)
export npm_config_cache="${TMP%/}/npm-cache"
export CI=1

RED=$'\033[31m'; GREEN=$'\033[32m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; OFF=$'\033[0m'
FAILURES=()

step() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$OFF"; }
ok()   { printf '%s  PASS%s %s\n' "$GREEN" "$OFF" "$1"; }
bad()  { printf '%s  FAIL%s %s\n' "$RED" "$OFF" "$1"; FAILURES+=("$1"); }
run()  { # run <label> <cmd...>
  local label="$1"; shift
  if "$@" > "$WORKDIR/last.log" 2>&1; then ok "$label"; else
    bad "$label"; printf '%s' "$DIM"; tail -n 25 "$WORKDIR/last.log"; printf '%s' "$OFF"
  fi
}

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

# ----------------------------------------------------------------- 1. build + pack
step "building and packing the library"
if ! (cd "$ROOT" && npm run build) > "$WORKDIR/build.log" 2>&1; then
  bad "npm run build"; tail -n 25 "$WORKDIR/build.log"; exit 1
fi
ok "npm run build"

if ! (cd "$ROOT" && npm pack --pack-destination "$WORKDIR") > "$WORKDIR/pack.log" 2>&1; then
  bad "npm pack"; tail -n 25 "$WORKDIR/pack.log"; exit 1
fi
TARBALL="$(ls "$WORKDIR"/use-formio-*.tgz | head -n1)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
ok "npm pack -> $(basename "$TARBALL")"

# a breaking release must not reuse a version that is already on the registry
if npm view "use-formio@$VERSION" version > /dev/null 2>&1; then
  bad "version $VERSION is already published on npm - bump package.json before releasing"
else
  ok "version $VERSION is not published yet"
fi

# ----------------------------------------------------------------- 2. packaging lint
step "packaging checks"
run "publint" npx --yes publint --pack npm
run "arethetypeswrong" npx --yes @arethetypeswrong/cli --pack "$ROOT"

# ----------------------------------------------------------------- 3. CJS + SSR
step "consumer: cjs-node (require + react-dom/server)"
APP="$WORKDIR/cjs-node"; mkdir -p "$APP"
cat > "$APP/package.json" <<'JSON'
{ "name": "cjs-node-consumer", "version": "1.0.0", "private": true }
JSON
cat > "$APP/app.js" <<'JS'
const React = require("react");
const { renderToString } = require("react-dom/server");
const mod = require("use-formio");

const expected = ["getUseFormio", "useCombineFormio", "useFormio"];
const actual = Object.keys(mod).sort();
if (expected.some(k => !actual.includes(k))) {
  throw new Error("missing runtime exports, got: " + actual.join(", "));
}

const e = React.createElement;
const App = () => {
  const form = mod.useFormio(
    { firstName: "", age: "" },
    {},
    { firstName: { validator: v => (v.length < 4 ? "min len is 4" : undefined) } }
  );
  return e(
    "form",
    null,
    e("input", { readOnly: true, value: form.fields.firstName.value }),
    e("div", { id: "keys" }, Object.keys(form.fields).join(",")),
    e("div", { id: "valid" }, String(form.isValid))
  );
};

const html = renderToString(e(App));
// `useSyncExternalStore` needs a server snapshot to render at all: this is the regression guard
if (!html.includes('id="keys"')) throw new Error("SSR produced no markup: " + html);
// 2.0 keeps the declaration order of the init state
if (!html.includes("firstName,age")) throw new Error("field key order changed: " + html);
console.log("cjs ssr html:", html);
JS
run "npm i react react-dom <tarball>" npm --prefix "$APP" i react react-dom "$TARBALL" --no-audit --no-fund
run "require() + renderToString" node "$APP/app.js"

# ----------------------------------------------------------------- 4. ESM + SSR
step "consumer: esm-node (import + react-dom/server)"
APP="$WORKDIR/esm-node"; mkdir -p "$APP"
cat > "$APP/package.json" <<'JSON'
{ "name": "esm-node-consumer", "version": "1.0.0", "private": true, "type": "module" }
JSON
cat > "$APP/app.js" <<'JS'
import React from "react";
import { renderToString } from "react-dom/server";
import { useFormio, useCombineFormio, getUseFormio } from "use-formio";

for (const [name, fn] of Object.entries({ useFormio, useCombineFormio, getUseFormio })) {
  if (typeof fn !== "function") throw new Error(`export ${name} is not a function`);
}

const e = React.createElement;
const useForm = getUseFormio({ a: "", b: "" }, {}, { a: { validator: v => (v ? undefined : "req") } });
const App = () => {
  const form = useCombineFormio({ one: useForm(), two: useFormio({ z: 1 }) });
  return e("div", null, Object.keys(form.forms.one.fields).join(","), String(form.isValid));
};

const html = renderToString(e(App));
if (!html.includes("a,b")) throw new Error("SSR/ESM output unexpected: " + html);
console.log("esm ssr html:", html);
JS
run "npm i react react-dom <tarball>" npm --prefix "$APP" i react react-dom "$TARBALL" --no-audit --no-fund
run "import + renderToString" node "$APP/app.js"

# ----------------------------------------------------------------- 5. types under node16
step "consumer: ts-node16 (tsc --noEmit, moduleResolution node16, strict)"
APP="$WORKDIR/ts-node16"; mkdir -p "$APP"
cat > "$APP/package.json" <<'JSON'
{ "name": "ts-node16-consumer", "version": "1.0.0", "private": true, "type": "module" }
JSON
cat > "$APP/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "jsx": "react-jsx",
    "skipLibCheck": false,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["esm.mts", "cjs.cts"]
}
JSON
# every public type export has to resolve through the `import` condition
cat > "$APP/esm.mts" <<'TS'
import { useFormio, useCombineFormio, getUseFormio } from "use-formio";
import type {
  Field, FieldValidator, FormioConfig, FormioForm, FormioFormState,
  FormioMetadata, FormioMetadataFns, FormioSchema, UserFieldValue,
  UserFormError, CombinedFormio
} from "use-formio";

declare const field: Field<string>;
const _value: string = field.value;
const _errors: string[] = field.errors;
const _isValidating: boolean = field.isValidating;
const _isValidated: boolean = field.isValidated;
field.set("x");
field.set(prev => prev + "y");
field.setErrors("one");
field.setErrors(["a", null, undefined]);
field.setErrors(null);
field.setErrors(prev => [...prev, "z"]);

type _1 = FieldValidator<string, { a: string }, undefined>;
type _2 = FormioConfig<{ a: string }, {}>;
type _3 = FormioSchema<{ a: string }, {}>;
type _4 = FormioFormState<{ a: string }>;
type _5 = FormioMetadata<{ a: string }, { a: () => { label: string } }, "a">;
type _6 = FormioMetadataFns<{ a: string }>;
type _7 = UserFieldValue;
type _8 = UserFormError;
type _9 = CombinedFormio<{}>;

// the 1.0.6 three argument call shape has to keep inferring exactly as it did
export const Component = () => {
  const form = useFormio(
    { firstName: "", age: "", isVerified: false },
    {},
    {
      firstName: { validator: value => [value.length > 10 ? "max len is 10" : undefined] },
      age: { validator: value => (value === "" ? "input cannot be empty" : undefined) },
      isVerified: { validator: value => (value === false ? "must be checked" : undefined) }
    }
  );
  const _values: Promise<{ firstName: string }> = form.getFormValues();
  const _legacy: Promise<{ firstName: string }> = form.getFieldsState(); // 1.0.6 name
  const _typed: FormioForm<{ firstName: string; age: string; isVerified: boolean }, any> =
    form as any;
  return form;
};

const useForm = getUseFormio({ a: "" }, {}, { a: { validator: () => undefined } });
export const Combined = () => {
  const combined = useCombineFormio({ one: useForm() });
  // 2.0 corrected this from `{ [K]: Promise<...> }` to `Promise<{ [K]: ... }>`
  const _reverted: Promise<Record<"one", unknown>> = combined.revertToInitState();
  return combined;
};
TS
# and through the `require` condition
cat > "$APP/cjs.cts" <<'TS'
import useFormioNs = require("use-formio");
import type { Field, FormioForm } from "use-formio";

export const component = () => {
  const form = useFormioNs.useFormio({ x: "" }, {}, { x: { validator: v => (v ? undefined : "req") } });
  const field: Field<string> = form.fields.x;
  const typed: FormioForm<{ x: string }, any> = form;
  return [field, typed] as const;
};
TS
run "npm i react react-dom @types/react typescript <tarball>" \
  npm --prefix "$APP" i react react-dom @types/react typescript "$TARBALL" --no-audit --no-fund
run "tsc --noEmit (node16 + strict, import and require)" \
  "$APP/node_modules/.bin/tsc" --noEmit -p "$APP/tsconfig.json"

# ----------------------------------------------------------------- 6. React 17 is refused
step "consumer: react17 (the peer dependency must refuse it)"
APP="$WORKDIR/react17"; mkdir -p "$APP"
cat > "$APP/package.json" <<'JSON'
{ "name": "react17-consumer", "version": "1.0.0", "private": true,
  "dependencies": { "react": "17.0.2", "react-dom": "17.0.2" } }
JSON
npm --prefix "$APP" i --no-audit --no-fund > "$WORKDIR/r17-install.log" 2>&1
if npm --prefix "$APP" i "$TARBALL" --no-audit --no-fund > "$WORKDIR/r17.log" 2>&1; then
  bad "React 17 install should have failed with ERESOLVE but succeeded"
else
  if grep -q 'peer react@">=18' "$WORKDIR/r17.log"; then
    ok "React 17 install refused with ERESOLVE (peer react >=18.0.0)"
  else
    bad "React 17 install failed, but not with the expected ERESOLVE peer message"
    printf '%s' "$DIM"; tail -n 20 "$WORKDIR/r17.log"; printf '%s' "$OFF"
  fi
fi

# and the runtime error a user sees if they push through with --legacy-peer-deps
npm --prefix "$APP" i "$TARBALL" --legacy-peer-deps --no-audit --no-fund > /dev/null 2>&1
cat > "$APP/app.js" <<'JS'
const React = require("react");
const { renderToString } = require("react-dom/server");
const { useFormio } = require("use-formio");
const App = () => React.createElement("div", null, useFormio({ a: "" }).fields.a.value);
try {
  renderToString(React.createElement(App));
  console.log("UNEXPECTED: React 17 rendered without throwing");
  process.exit(1);
} catch (err) {
  console.log("React 17 runtime error: " + err.message);
  if (!/useSyncExternalStore is not a function/.test(err.message)) process.exit(1);
}
JS
run "React 17 runtime fails with 'useSyncExternalStore is not a function'" node "$APP/app.js"

# ----------------------------------------------------------------- summary
printf '\n%s================ summary ================%s\n' "$BOLD" "$OFF"
if [ ${#FAILURES[@]} -eq 0 ]; then
  printf '%sall consumer checks passed%s (use-formio@%s)\n' "$GREEN" "$OFF" "$VERSION"
  exit 0
fi
printf '%s%d check(s) failed:%s\n' "$RED" "${#FAILURES[@]}" "$OFF"
for f in "${FAILURES[@]}"; do printf '  - %s\n' "$f"; done
exit 1
