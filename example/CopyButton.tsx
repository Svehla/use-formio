import * as React from "react";
import { useCopyToClipboard } from "./hooks";

/** a small "Copy" / "Copied" button; `getText` is read at click time */
export const CopyButton = (props: { getText: () => string; label: string; className?: string }) => {
  const [copied, copy] = useCopyToClipboard();

  return (
    <button
      type="button"
      className={props.className ? `copy ${props.className}` : "copy"}
      data-copied={copied}
      aria-label={copied ? "Copied" : props.label}
      aria-live="polite"
      onClick={() => copy(props.getText())}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};
