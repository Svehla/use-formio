import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/example.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { AdvancedFieldMetadataValidations } from "./examples/AdvancedFieldMetadataValidations";
import { AsyncValidations } from "./examples/AsyncValidations";
import { CrossValidations } from "./examples/CrossValidations";
import { CustomFormSchemaFramework } from "./examples/CustomFormSchemaFramework";
import { DebouncedInput } from "./examples/DebouncedInput";
import { DynamicForms } from "./examples/DynamicForms";
import { ExampleNameContext, StateHiddenContext } from "./ExampleContext";
import { FieldMetadata } from "./examples/FieldMetadata";
import { Footer } from "./Footer";
import { GithubIcon } from "./icons";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { InputConstrains } from "./examples/InputConstrains";
import { LifecycleHooks } from "./examples/LifecycleHooks";
import { OnTouchValidation } from "./examples/OnTouchValidation";
import { OptimizedObjectRecreating } from "./examples/OptimizedObjectRecreating";
import { RevertToInitState } from "./examples/RevertToInitState";
import { Sidebar, TocTabs } from "./Toc";
import { SourcePane } from "./SourcePane";
import { StableMethodPointers } from "./examples/StableMethodPointers";
import { SyncSetValuesBasedOnPrevValue } from "./examples/SyncSetValuesBasedOnPrevValue";
import { SyncValidations } from "./examples/SyncValidations";
import { ThrottledCallToServer } from "./examples/ThrottledCallToServer";
import { UncontrolledInput } from "./examples/UncontrolledInput";
import { UseCombineFormioExample } from "./examples/UseCombineFormioExample";
import { exampleFileUrl } from "./constants";
// build-time highlighted source code of every example (always in sync with the files on disk)
import { codePaletteCss, exampleSourcesHtml } from "./exampleSources";
import { useWideLayout } from "./hooks";

type Example = {
  title: string;
  /** one line under the title: what the example proves */
  description: React.ReactNode;
  /** file name in `examples/`, also the section anchor and the `data-testid` prefix */
  githubFileName: keyof typeof exampleSourcesHtml;
  Comp: React.ComponentType;
  html: string;
};

const examples = {
  basic: [
    {
      title: "Synchronous validations",
      description: (
        <>
          A validator returns a message, a list of messages or <code>undefined</code>; the errors
          land on the field that produced them.
        </>
      ),
      githubFileName: "SyncValidations",
      Comp: SyncValidations,
      html: exampleSourcesHtml.SyncValidations
    },
    {
      title: "Field metadata",
      description: (
        <>
          Labels and limits are derived per field from the form state and handed to both the
          validator and the UI.
        </>
      ),
      githubFileName: "FieldMetadata",
      Comp: FieldMetadata,
      html: exampleSourcesHtml.FieldMetadata
    },
    {
      title: "Async validations",
      description: (
        <>
          Async validators flip <code>isValidating</code> on the field and on the form while they
          run; submit waits for them. These ones fail at random on purpose.
        </>
      ),
      githubFileName: "AsyncValidations",
      Comp: AsyncValidations,
      html: exampleSourcesHtml.AsyncValidations
    },
    {
      title: "Input constraints",
      description: (
        <>
          <code>shouldChangeValue</code> rejects a write before it happens - a value that fails it
          never enters the state.
        </>
      ),
      githubFileName: "InputConstrains",
      Comp: InputConstrains,
      html: exampleSourcesHtml.InputConstrains
    },
    {
      title: "Cross validations",
      description: (
        <>
          A validator receives the whole form state, so one field&apos;s rule can depend on
          another field&apos;s value.
        </>
      ),
      githubFileName: "CrossValidations",
      Comp: CrossValidations,
      html: exampleSourcesHtml.CrossValidations
    },
    {
      title: "Revert to the initial state",
      description: (
        <>
          <code>revertToInitState()</code> restores the initial values and clears errors and
          validation flags in one call.
        </>
      ),
      githubFileName: "RevertToInitState",
      Comp: RevertToInitState,
      html: exampleSourcesHtml.RevertToInitState
    },
    {
      title: "Combine forms",
      description: (
        <>
          <code>useCombineFormio</code> folds several forms into one <code>validate()</code>,{" "}
          <code>isValid</code> and <code>isValidating</code>.
        </>
      ),
      githubFileName: "UseCombineFormioExample",
      Comp: UseCombineFormioExample,
      html: exampleSourcesHtml.UseCombineFormioExample
    },
    {
      title: "Lifecycle hooks",
      description: (
        <>
          <code>afterSet</code> hooks per field and for the whole form, each fired exactly once
          per <code>set()</code>; open the console to watch them.
        </>
      ),
      githubFileName: "LifecycleHooks",
      Comp: LifecycleHooks,
      html: exampleSourcesHtml.LifecycleHooks
    },
    {
      title: "Set values based on the previous value",
      description: (
        <>
          <code>set(prev =&gt; next)</code> updaters apply synchronously and in order, so the
          validation that follows sees the final value.
        </>
      ),
      githubFileName: "SyncSetValuesBasedOnPrevValue",
      Comp: SyncSetValuesBasedOnPrevValue,
      html: exampleSourcesHtml.SyncSetValuesBasedOnPrevValue
    },
    {
      title: "On-touch validation",
      description: (
        <>
          Validate on every keystroke only once a field has been invalid - a common UX rule built
          from <code>errors</code> alone, without a library flag.
        </>
      ),
      githubFileName: "OnTouchValidation",
      Comp: OnTouchValidation,
      html: exampleSourcesHtml.OnTouchValidation
    },
    {
      title: "Uncontrolled input",
      description: (
        <>
          An uncontrolled <code>&lt;textarea&gt;</code> that syncs into the form on blur; the live
          state shows exactly when.
        </>
      ),
      githubFileName: "UncontrolledInput",
      Comp: UncontrolledInput,
      html: exampleSourcesHtml.UncontrolledInput
    }
  ],
  advanced: [
    {
      title: "Stable method pointers",
      description: (
        <>
          <code>set</code> and <code>validate</code> keep their identity across renders, so{" "}
          <code>React.memo</code> children skip work. The background colour changes on every
          render.
        </>
      ),
      githubFileName: "StableMethodPointers",
      Comp: StableMethodPointers,
      html: exampleSourcesHtml.StableMethodPointers
    },
    {
      title: "Debounced input",
      description: (
        <>
          A 500 ms debounce between the DOM and <code>set()</code>: the live state updates half a
          second after you stop typing.
        </>
      ),
      githubFileName: "DebouncedInput",
      Comp: DebouncedInput,
      html: exampleSourcesHtml.DebouncedInput
    },
    {
      title: "Throttled call to the server",
      description: (
        <>
          A fake request throttled to once per second while <code>set()</code> keeps the input
          itself instant.
        </>
      ),
      githubFileName: "ThrottledCallToServer",
      Comp: ThrottledCallToServer,
      html: exampleSourcesHtml.ThrottledCallToServer
    },
    {
      title: "Optimised object recreation",
      description: (
        <>
          Spreading a field into props or passing the field object: both stay memo-friendly,
          because an empty <code>errors</code> array is a stable pointer too.
        </>
      ),
      githubFileName: "OptimizedObjectRecreating",
      Comp: OptimizedObjectRecreating,
      html: exampleSourcesHtml.OptimizedObjectRecreating
    },
    {
      title: "Advanced field metadata validations",
      description: (
        <>
          A declarative layer on top of the hook: metadata drives <code>isActive</code>, min / max
          length and allowed options.
        </>
      ),
      githubFileName: "AdvancedFieldMetadataValidations",
      Comp: AdvancedFieldMetadataValidations,
      html: exampleSourcesHtml.AdvancedFieldMetadataValidations
    },
    {
      title: "Custom form schema framework",
      description: (
        <>
          Fourteen fields rendered from a schema; the input component is picked from the inferred
          value type.
        </>
      ),
      githubFileName: "CustomFormSchemaFramework",
      Comp: CustomFormSchemaFramework,
      html: exampleSourcesHtml.CustomFormSchemaFramework
    },
    {
      title: "Dynamic forms",
      description: (
        <>
          Add, reorder and remove sub-forms at runtime and validate them together with{" "}
          <code>useCombineFormio</code>.
        </>
      ),
      githubFileName: "DynamicForms",
      Comp: DynamicForms,
      html: exampleSourcesHtml.DynamicForms
    }
  ]
} satisfies { basic: Example[]; advanced: Example[] };

/**
 * The 18 pre-highlighted snippets are ~4.700 DOM nodes - more than half of the whole page - and
 * nothing on the first screen depends on them. Mounting them inside a `startTransition` lets
 * React 19 render them *concurrently*: the demos paint first, and the snippets are built in
 * short, interruptible slices instead of one long blocking task.
 *
 * This only moves the work off the critical path (it is the same total amount of work), which is
 * exactly what "no long task on load" needs. The source boxes have a fixed height, so mounting
 * the snippets late does not move anything on the page. See `example/PERF.md`.
 */
const useDeferredSnippets = () => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    React.startTransition(() => setReady(true));
  }, []);

  return ready;
};

const App = () => {
  const wide = useWideLayout();
  const showCode = useDeferredSnippets();

  return (
    <div data-testid="app" className="app">
      {/* the ~20 colour classes of the build-time highlighted snippets, see exampleSources.ts */}
      <style>{codePaletteCss}</style>
      <Header />

      <div className="shell">
        {wide && <Sidebar groups={examples} />}

        <main className="main">
          <Hero />

          <div className="examples-head" id="examples">
            <p className="kicker">18 live examples</p>
            <h2>Every example is the file that renders it</h2>
            <p>
              The demos below run against the library source in the repository, and the code in
              the dark column next to each one is that exact file, highlighted at build time. Type
              into a form and watch the live state on its left change.
            </p>
          </div>

          {!wide && <TocTabs groups={examples} />}

          {examples.basic.map(e => (
            <ExampleSection key={e.githubFileName} {...e} showCode={showCode} />
          ))}
          {examples.advanced.map(e => (
            <ExampleSection key={e.githubFileName} {...e} showCode={showCode} />
          ))}
        </main>
      </div>

      <Footer />
    </div>
  );
};

/**
 * One `<section>` of the page - one row of the split layout: the header, the live state and the
 * demo in the light content column (`.example__main`), the source snippet in the dark rail on
 * the right (`.source`). On narrow viewports the rail stacks underneath, behind a tab.
 *
 * `React.memo` is what keeps the page cheap to interact with: every example owns all of its own
 * state, so typing into one of them must never make React re-render (or even re-compare) the
 * other 17 sections and their ~400 node code columns. The props come from the module level
 * `examples` object, so they are referentially stable and the memo always hits.
 */
const ExampleSection = React.memo((props: Example & { showCode: boolean }) => {
  const wide = useWideLayout();
  // narrow layout only: which of the two tabs under the demo is open
  const [tab, setTab] = React.useState<"state" | "source">("state");
  // the snippet is only mounted once the reader asked for it (narrow layout)
  const [sourceRequested, setSourceRequested] = React.useState(false);
  const name = props.githubFileName;

  const sourceOpen = wide || tab === "source";
  const sourceMounted = props.showCode && (wide || sourceRequested);
  const githubTitle = `${name}.tsx on GitHub`;

  return (
    <ExampleNameContext.Provider value={name}>
      <StateHiddenContext.Provider value={!wide && tab !== "state"}>
        <section className="example" data-testid={`example-${name}`} data-example={name}>
          <div className="example__main">
            <header className="example__head">
              <div className="example__title">
                <a
                  className="example__github"
                  data-testid={`${name}-github-link`}
                  href={exampleFileUrl(name)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={githubTitle}
                  title={githubTitle}
                >
                  <GithubIcon />
                </a>
                <h3 id={name} data-testid={`${name}-heading`}>
                  <a href={`#${name}`}>{props.title}</a>
                </h3>
              </div>
              <p className="example__desc">{props.description}</p>
            </header>

            <div className="example__body">
              <props.Comp />

              {!wide && (
                <div className="tabs" role="tablist" aria-label={`${props.title}: state or source`}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "state"}
                    onClick={() => setTab("state")}
                  >
                    Live state
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "source"}
                    data-testid={`${name}-toggle-code`}
                    onClick={() => {
                      setTab("source");
                      setSourceRequested(true);
                    }}
                  >
                    Source
                  </button>
                </div>
              )}
            </div>
          </div>

          {(wide || sourceRequested) && (
            <SourcePane name={name} html={props.html} mounted={sourceMounted} hidden={!sourceOpen} />
          )}
        </section>
      </StateHiddenContext.Provider>
    </ExampleNameContext.Provider>
  );
});

ExampleSection.displayName = "ExampleSection";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

/**
 * `StrictMode` is on because the library is now StrictMode safe: `useFormio` keeps its state in
 * an external store (`useSyncExternalStore`), so the double invoked renders / effects of
 * StrictMode's development mode cannot double apply a `set()` or double fire an `afterSet` hook.
 * Keeping it on makes the docs app catch such regressions during `npm run dev`.
 */
createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
