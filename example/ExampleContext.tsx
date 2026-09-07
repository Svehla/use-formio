import * as React from "react";

/**
 * Name of the currently rendered example (e.g. `"SyncValidations"`).
 *
 * It is only used by the docs chrome (`DEBUG_FormWrapper`) so that every
 * example can expose stable `data-testid` attributes without polluting the
 * example source code that is shown to the reader.
 */
export const ExampleNameContext = React.createContext<string>("Example");

export const useExampleName = () => React.useContext(ExampleNameContext);

/**
 * `true` while the narrow layout's "Live state" / "Source" tab strip has the *Source* tab
 * selected, i.e. the live state pane rendered by `DEBUG_FormWrapper` has to be hidden.
 * Always `false` in the wide layout, where all three panes are visible.
 */
export const StateHiddenContext = React.createContext<boolean>(false);
