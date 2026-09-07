import * as React from "react";

/**
 * From this viewport width up the page uses the wide layout: the sticky sidebar table of
 * contents, and the demo / live state / source panes of every example side by side. Below it the
 * table of contents is a tab strip and "Live state" / "Source" become tabs under the demo.
 *
 * Keep in sync with the `(min-width: 1200px)` media queries in `styles/*.css`.
 */
export const WIDE_LAYOUT_MIN_WIDTH = 1200;

let wideQuery: MediaQueryList | undefined;

const getWideQuery = () =>
  (wideQuery ??= window.matchMedia(`(min-width: ${WIDE_LAYOUT_MIN_WIDTH}px)`));

const subscribeToWideLayout = (onStoreChange: () => void) => {
  const query = getWideQuery();
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
};

/**
 * `true` while the viewport is wide enough for the side-by-side layout.
 *
 * One `matchMedia` query shared by every component that needs it (through
 * `useSyncExternalStore`), so the browser only wakes the page up when the layout really flips -
 * never once per pixel of a window resize. This replaced a `useWindowDimensions()` hook that
 * every layout component used to call, each with its own `resize` listener and its own state.
 */
export const useWideLayout = () =>
  React.useSyncExternalStore(
    subscribeToWideLayout,
    () => getWideQuery().matches,
    // no SSR here, but `useSyncExternalStore` requires a server snapshot: assume the wide layout
    () => true
  );

/**
 * The example section currently "in view" - the first one (in page order) whose box overlaps the
 * band between the top bar and roughly the middle of the viewport. Used by the sidebar to
 * highlight the current entry; it moves nothing on the page itself.
 *
 * One `IntersectionObserver` for all sections. It only fires while scrolling, so the booted page
 * stays idle (see `e2e/perf.spec.ts`), and it only re-renders the component that calls it.
 */
export const useActiveSection = (sectionNames: readonly string[]) => {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const name = (entry.target as HTMLElement).dataset.example;
          if (!name) continue;
          if (entry.isIntersecting) visible.add(name);
          else visible.delete(name);
        }
        const next = sectionNames.find(name => visible.has(name));
        if (next) setActive(next);
      },
      { rootMargin: "-64px 0px -55% 0px" }
    );

    for (const name of sectionNames) {
      const el = document.querySelector(`section[data-example="${name}"]`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sectionNames]);

  return active;
};

/**
 * `[copied, copy]` - `copy(text)` writes to the clipboard and flips `copied` to `true` for a
 * moment so the button can say "Copied". Falls back to `execCommand("copy")` where the async
 * clipboard API is unavailable (plain http, older browsers).
 */
export const useCopyToClipboard = (resetAfterMs = 1600) => {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
        } finally {
          textarea.remove();
        }
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetAfterMs);
    },
    [resetAfterMs]
  );

  return [copied, copy] as const;
};
