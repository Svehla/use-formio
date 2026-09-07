import * as React from "react";
import { GithubIcon, LogoMark, LogoWordmark, NpmIcon } from "./icons";
import { NPM_URL, REPO_URL, VERSION } from "./constants";
import { ThemeToggle } from "./ThemeToggle";

/** the sticky top bar: brand, version, project links, theme toggle */
export const Header = () => (
  <header className="topbar" data-testid="site-header">
    <div className="topbar__inner">
      <a className="brand" href="./" aria-label="use-formio, back to the top">
        <LogoMark className="brand__mark" />
        <LogoWordmark className="brand__word" />
      </a>
      <span className="badge" title="library version">
        v{VERSION}
      </span>

      <nav className="topbar__links" aria-label="Project links">
        <a href={NPM_URL} target="_blank" rel="noreferrer" data-testid="npm-link">
          <NpmIcon />
          <span>npm</span>
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer" data-testid="github-link">
          <GithubIcon />
          <span>GitHub</span>
        </a>
        <ThemeToggle />
      </nav>
    </div>
  </header>
);
