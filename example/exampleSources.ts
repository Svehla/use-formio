/**
 * Pre-highlighted source code of every example, used to render the code snippets next to the
 * live demos.
 *
 * The `?raw` imports below are rewritten at build time by the `highlightExampleSources` vite
 * plugin (see `example/vite.config.ts`): what actually lands in the bundle is not the file
 * content but `{ html, palette }` - the finished shiki markup of the *processed* source (imports
 * rewritten to `"use-formio"`, the docs-only `<DEBUG_FormWrapper>` stripped) and the handful of
 * colour classes it uses (`raw-snippets.d.ts` has the shape).
 *
 * That means:
 * - shiki is a build-time dependency only, it is not shipped to the browser;
 * - the docs page does zero syntax highlighting work while it boots.
 *
 * The `html` values are handed straight to `<CodeBlock html={...} />`; the palettes are merged
 * into `codePaletteCss` below, one `<style>` rendered by the app.
 */
import snippet_AdvancedFieldMetadataValidations from "./examples/AdvancedFieldMetadataValidations.tsx?raw";
import snippet_AsyncValidations from "./examples/AsyncValidations.tsx?raw";
import snippet_CrossValidations from "./examples/CrossValidations.tsx?raw";
import snippet_CustomFormSchemaFramework from "./examples/CustomFormSchemaFramework.tsx?raw";
import snippet_DebouncedInput from "./examples/DebouncedInput.tsx?raw";
import snippet_DynamicForms from "./examples/DynamicForms.tsx?raw";
import snippet_FieldMetadata from "./examples/FieldMetadata.tsx?raw";
import snippet_InputConstrains from "./examples/InputConstrains.tsx?raw";
import snippet_LifecycleHooks from "./examples/LifecycleHooks.tsx?raw";
import snippet_OnTouchValidation from "./examples/OnTouchValidation.tsx?raw";
import snippet_OptimizedObjectRecreating from "./examples/OptimizedObjectRecreating.tsx?raw";
import snippet_RevertToInitState from "./examples/RevertToInitState.tsx?raw";
import snippet_StableMethodPointers from "./examples/StableMethodPointers.tsx?raw";
import snippet_SyncSetValuesBasedOnPrevValue from "./examples/SyncSetValuesBasedOnPrevValue.tsx?raw";
import snippet_SyncValidations from "./examples/SyncValidations.tsx?raw";
import snippet_ThrottledCallToServer from "./examples/ThrottledCallToServer.tsx?raw";
import snippet_UncontrolledInput from "./examples/UncontrolledInput.tsx?raw";
import snippet_UseCombineFormioExample from "./examples/UseCombineFormioExample.tsx?raw";
/**
 * The hero's "type inference moment" (`snippets/TypeInference.tsx`). It is a real, type-checked
 * file - `npm run ts:check-types` compiles it, including its `@ts-expect-error` line - and it
 * goes through the same build-time highlighter as the examples.
 */
import snippet_TypeInference from "./snippets/TypeInference.tsx?raw";

const exampleSnippets = {
  AdvancedFieldMetadataValidations: snippet_AdvancedFieldMetadataValidations,
  AsyncValidations: snippet_AsyncValidations,
  CrossValidations: snippet_CrossValidations,
  CustomFormSchemaFramework: snippet_CustomFormSchemaFramework,
  DebouncedInput: snippet_DebouncedInput,
  DynamicForms: snippet_DynamicForms,
  FieldMetadata: snippet_FieldMetadata,
  InputConstrains: snippet_InputConstrains,
  LifecycleHooks: snippet_LifecycleHooks,
  OnTouchValidation: snippet_OnTouchValidation,
  OptimizedObjectRecreating: snippet_OptimizedObjectRecreating,
  RevertToInitState: snippet_RevertToInitState,
  StableMethodPointers: snippet_StableMethodPointers,
  SyncSetValuesBasedOnPrevValue: snippet_SyncSetValuesBasedOnPrevValue,
  SyncValidations: snippet_SyncValidations,
  ThrottledCallToServer: snippet_ThrottledCallToServer,
  UncontrolledInput: snippet_UncontrolledInput,
  UseCombineFormioExample: snippet_UseCombineFormioExample
};

export type ExampleName = keyof typeof exampleSnippets;

/** highlighted markup of every example, keyed by the example (file) name */
export const exampleSourcesHtml = Object.fromEntries(
  Object.entries(exampleSnippets).map(([name, snippet]) => [name, snippet.html])
) as Record<ExampleName, string>;

export const heroSnippetHtml = snippet_TypeInference.html;

/**
 * The colour classes of all snippets, as one stylesheet: `.c1a2b3{--shiki-light:#…;--shiki-dark:#…}`.
 * About twenty rules - the two themes only have that many distinct token colours - built once at
 * module evaluation and rendered by the app as a single `<style>`.
 */
export const codePaletteCss = Object.entries(
  Object.assign({}, ...Object.values(exampleSnippets).map(s => s.palette), snippet_TypeInference.palette)
)
  .map(([className, style]) => `.${className}{${style}}`)
  .join("\n");
