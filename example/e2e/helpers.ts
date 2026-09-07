import { expect, Locator, Page } from "@playwright/test";

/**
 * Every example section on the docs page, in render order.
 * Mirrors the `examples.basic` / `examples.advanced` arrays in `example/index.tsx`.
 */
export const BASIC_EXAMPLES = [
  "SyncValidations",
  "FieldMetadata",
  "AsyncValidations",
  "InputConstrains",
  "CrossValidations",
  "RevertToInitState",
  "UseCombineFormioExample",
  "LifecycleHooks",
  "SyncSetValuesBasedOnPrevValue",
  "OnTouchValidation",
  "UncontrolledInput"
] as const;

export const ADVANCED_EXAMPLES = [
  "StableMethodPointers",
  "DebouncedInput",
  "ThrottledCallToServer",
  "OptimizedObjectRecreating",
  "AdvancedFieldMetadataValidations",
  "CustomFormSchemaFramework",
  "DynamicForms"
] as const;

export const ALL_EXAMPLES = [...BASIC_EXAMPLES, ...ADVANCED_EXAMPLES];

/**
 * Small typed facade over the `data-testid` scheme documented in `example/README.md`.
 *
 * `new Example(page, "SyncValidations").input("age")` ==
 * `page.getByTestId("SyncValidations-age-input")`
 */
export class Example {
  constructor(readonly page: Page, readonly name: string) {}

  /** the `<section>` wrapping this example */
  get section(): Locator {
    return this.page.getByTestId(`example-${this.name}`);
  }

  get heading(): Locator {
    return this.page.getByTestId(`${this.name}-heading`);
  }

  input(field: string): Locator {
    return this.page.getByTestId(`${this.name}-${field}-input`);
  }

  fieldErrors(field: string): Locator {
    return this.page.getByTestId(`${this.name}-${field}-errors`);
  }

  /** form level (all fields) error summary, only some examples render one */
  get errors(): Locator {
    return this.page.getByTestId(`${this.name}-errors`);
  }

  get submit(): Locator {
    return this.page.getByTestId(`${this.name}-submit`);
  }

  get result(): Locator {
    return this.page.getByTestId(`${this.name}-result`);
  }

  /** raw JSON dump of the live form state rendered by `DEBUG_FormWrapper` */
  get stateEl(): Locator {
    return this.page.getByTestId(`${this.name}-state`);
  }

  testId(suffix: string): Locator {
    return this.page.getByTestId(`${this.name}-${suffix}`);
  }

  /**
   * Parsed `DEBUG_FormWrapper` JSON. `DEBUG_FormWrapper` dumps the whole object
   * returned by `useFormio` minus `__dangerous`, so the shape is:
   *
   *   { fields: { <name>: { value, errors, isValidating } }, isValidating, isValid }
   *
   * and for `useCombineFormio`:
   *
   *   { isValidating, isValid, forms: { <formKey>: { fields: {...}, ... } } }
   */
  async state(): Promise<any> {
    return JSON.parse((await this.stateEl.innerText()).trim());
  }

  /** `{ value, errors, isValidating }` of one field, straight from the state dump */
  async fieldState(field: string): Promise<any> {
    return (await this.state()).fields[field];
  }

  /** scroll the example into view, useful before interacting with it */
  async reveal() {
    await this.heading.scrollIntoViewIfNeeded();
  }
}

/**
 * Wait until the JSON rendered by `DEBUG_FormWrapper` satisfies `predicate`.
 * Used by the debounce / async examples where the assertion is on form *state*
 * rather than on a rendered string.
 */
export const expectFormState = async (
  example: Example,
  predicate: (state: any) => boolean,
  message?: string
) => {
  await expect
    .poll(
      async () => {
        try {
          return predicate(await example.state());
        } catch {
          return false;
        }
      },
      { message: message ?? `form state of ${example.name} never matched`, timeout: 10_000 }
    )
    .toBe(true);
};

/** the resolved `background-color` of the closest wrapper `<div>` around an input */
export const inputBackgroundColor = (input: Locator) =>
  input.locator("xpath=..").evaluate(el => getComputedStyle(el).backgroundColor);

/**
 * Attach console + pageerror collectors to a page.
 *
 * Returns the accumulated messages so a test can assert the page produced no
 * errors. React logs its warnings through `console.error`, so this catches
 * "key" warnings, act() warnings, invalid-prop warnings, etc. too.
 */
export const collectPageProblems = (page: Page) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", err => pageErrors.push(String(err?.stack ?? err)));

  return { consoleErrors, pageErrors };
};

/** collect every `console.log` line, used by the LifecycleHooks spec */
export const collectConsoleLogs = (page: Page) => {
  const logs: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "log") logs.push(msg.text());
  });
  return logs;
};
