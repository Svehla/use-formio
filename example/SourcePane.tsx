import * as React from "react";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";

/**
 * The "Source" pane of an example: file name, copy button, and the build-time highlighted
 * snippet in a box that scrolls on its own (so a 300 line example does not make its section
 * 300 lines tall and the page never scrolls horizontally).
 *
 * The copy button reads `textContent` of the rendered `<pre>` - the plain source is exactly the
 * text of the highlighted markup, so nothing extra has to ship in the bundle.
 *
 * `React.memo` keeps the ~400 node snippet out of every re-render of the example; the props are
 * a module-level string and two booleans.
 */
export const SourcePane = React.memo(
  (props: { name: string; html: string; mounted: boolean; hidden: boolean }) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    return (
      <div className="source" hidden={props.hidden}>
        <div className="pane-head">
          <span className="pane-label">Source</span>
          <span className="source__file">examples/{props.name}.tsx</span>
          <CopyButton
            label={`Copy the source of ${props.name}`}
            getText={() => scrollRef.current?.querySelector("pre")?.textContent ?? ""}
          />
        </div>
        <div
          className="source__scroll"
          ref={scrollRef}
          tabIndex={0}
          aria-label={`Source code of examples/${props.name}.tsx`}
        >
          {props.mounted && <CodeBlock data-testid={`${props.name}-code`} html={props.html} />}
        </div>
      </div>
    );
  }
);

SourcePane.displayName = "SourcePane";
