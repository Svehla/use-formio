import * as React from "react";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { FACTS } from "./constants";
import { heroSnippetHtml } from "./exampleSources";
import { LogoHorizontal } from "./icons";

const INSTALL = "npm install use-formio";

/**
 * The first row of the split page: the big horizontal logo, the thesis, the install line and the
 * three measured facts on the left; the "type inference moment" snippet at the top of the dark
 * source rail on the right (it stacks underneath on narrow viewports).
 */
export const Hero = () => (
  <section className="hero" id="intro" data-testid="intro">
    <div className="hero__text">
      <h1 className="hero__logo">
        <LogoHorizontal />
      </h1>
      <p className="hero__tagline">
        Forms as plain state. <em>Types for free.</em>
      </p>
      <p className="lead">
        <code>useFormio</code> turns an object of initial values into a fully typed form - fields,
        synchronous and asynchronous validation, and nothing else. No schema language, no form
        component to wrap your inputs in: you keep your own UI and your own business model, and
        TypeScript infers every field type from the values you already wrote.
      </p>

      <div className="install" id="installation" data-testid="installation">
        <code>{INSTALL}</code>
        <CopyButton label="Copy the install command" getText={() => INSTALL} />
      </div>

      <dl className="facts">
        <div>
          <dt>bundle, {FACTS.sizeNote}</dt>
          <dd>
            {FACTS.sizeKB}
            <small>kB</small>
          </dd>
        </div>
        <div>
          <dt>dependencies</dt>
          <dd>{FACTS.dependencies}</dd>
        </div>
        <div>
          <dt>peer range</dt>
          <dd>
            <small style={{ marginLeft: 0, marginRight: 4 }}>React</small>
            {FACTS.react}
          </dd>
        </div>
      </dl>
    </div>

    <figure className="hero__code">
      <figcaption>
        <span>You write the values. TypeScript writes the types.</span>
        <code>snippets/TypeInference.tsx</code>
      </figcaption>
      <CodeBlock html={heroSnippetHtml} data-testid="hero-snippet" />
    </figure>
  </section>
);
