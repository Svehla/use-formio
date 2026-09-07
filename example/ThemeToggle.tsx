import * as React from "react";
import { MoonIcon, SunIcon } from "./icons";

const STORAGE_KEY = "use-formio:theme";

type Theme = "light" | "dark";

const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
};

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Light / dark switch. With no stored choice the page follows the system preference (the CSS
 * `prefers-color-scheme` block); a click stores an explicit choice in `localStorage` and stamps
 * it on `<html data-theme>` (the inline script in `index.html` re-applies it before first paint).
 */
export const ThemeToggle = () => {
  const [explicit, setExplicit] = React.useState<Theme | null>(readStoredTheme);
  const effective = explicit ?? systemTheme();
  const next: Theme = effective === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode / storage disabled: the choice still applies for this page view
    }
    setExplicit(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-testid="theme-toggle"
    >
      {effective === "dark" ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
    </button>
  );
};
