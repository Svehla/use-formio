import * as React from "react";
import { ISSUES_URL, NPM_URL, REPO_URL } from "./constants";
import { LogoWordmark } from "./icons";

export const Footer = () => (
  <footer className="footer">
    <div className="footer__inner">
      <LogoWordmark className="brand__word" />
      <span>MIT license · Jakub Švehla</span>
      <nav aria-label="Footer links">
        <a href={NPM_URL} target="_blank" rel="noreferrer">
          npm
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={ISSUES_URL} target="_blank" rel="noreferrer">
          Issues
        </a>
        <a href={`${REPO_URL}/tree/main/example`} target="_blank" rel="noreferrer">
          This page's source
        </a>
      </nav>
      <p>
        Every demo on this page runs against the library source in the repository, and every
        snippet is the file that produced the demo next to it - highlighted at build time, never
        copied by hand.
      </p>
    </div>
  </footer>
);
