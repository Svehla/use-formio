import * as React from "react";
import { StateHiddenContext, useExampleName } from "./ExampleContext";
import { CodeBlock } from "./CodeBlock";
import { highlightJson } from "./highlightJson";

/**
 * Strips the library-internal `__dangerous` key (also from the nested forms of a
 * `useCombineFormio` result) so that the dump only shows the public form state.
 *
 * Every level has to be *copied* before the key is deleted. The previous version only copied
 * `forms` itself and then `delete`d `__dangerous` off the sub-form objects in place - i.e. it
 * mutated the very objects `useFormio` keeps as its per-render cache, so the next render of that
 * sub-form crashed on `last.__dangerous.formState`. It only ever survived because nothing
 * re-rendered a combined sub-form after its dump had been drawn.
 */
const clearFormStateJSON = (json: any) => {
  const nJson = { ...json };
  delete nJson.__dangerous;

  // clear combineFormio nested fields
  if (nJson.forms) {
    nJson.forms = Object.fromEntries(
      Object.entries(nJson.forms).map(([key, form]) => {
        const nForm = { ...(form as Record<string, unknown>) };
        delete nForm.__dangerous;
        return [key, nForm];
      })
    );
  }

  return nJson;
};

/**
 * The state dump is on the hot path of every keystroke, so it is isolated behind `React.memo`
 * keyed by the *serialised* state: a re-render that does not change the JSON (`isValidating`
 * flipping back and forth, a parent re-render, ...) does not re-highlight anything and does not
 * touch the DOM.
 */
const FormStateDump = React.memo((props: { json: string; testId: string }) => {
  const html = React.useMemo(() => highlightJson(props.json), [props.json]);

  return <CodeBlock language="json" data-testid={props.testId} html={html} />;
});

FormStateDump.displayName = "FormStateDump";

/**
 * Docs-only chrome around every example: renders the example's own UI as the *Demo* pane and the
 * value returned by `useFormio` / `useCombineFormio` as the collapsible *Live form state* pane.
 * It is stripped from the displayed source snippets (see `vite.config.ts`).
 *
 * The two panes are siblings (a fragment), so the example section can lay them out on its grid.
 */
export const DEBUG_FormWrapper = (props: { form: any; children?: React.ReactNode }) => {
  const exampleName = useExampleName();
  const hidden = React.useContext(StateHiddenContext);

  return (
    <>
      <div className="demo">{props.children}</div>

      <details className="state" open hidden={hidden}>
        <summary>
          <span className="pane-label">Live form state</span>
          <span className="state__hint">what the hook returns</span>
        </summary>
        <FormStateDump
          testId={`${exampleName}-state`}
          json={JSON.stringify(clearFormStateJSON(props.form), null, 2)}
        />
      </details>
    </>
  );
};
