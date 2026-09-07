import * as React from "react";
import { useActiveSection } from "./hooks";

export type TocEntry = { title: string; githubFileName: string };
export type TocGroups = { basic: readonly TocEntry[]; advanced: readonly TocEntry[] };

const pad = (n: number) => String(n).padStart(2, "0");

const TocList = (props: { entries: readonly TocEntry[]; active: string | null; offset?: number }) => (
  <ol>
    {props.entries.map((e, index) => (
      <li key={e.githubFileName}>
        <a
          href={`#${e.githubFileName}`}
          data-testid={`toc-${e.githubFileName}`}
          aria-current={props.active === e.githubFileName ? "true" : undefined}
        >
          <span className="toc-num">{pad((props.offset ?? 0) + index + 1)}</span>
          <span>{e.title}</span>
        </a>
      </li>
    ))}
  </ol>
);

/** the sticky sidebar of the wide layout, with the section in view highlighted */
export const Sidebar = (props: { groups: TocGroups }) => {
  const names = React.useMemo(
    () => [...props.groups.basic, ...props.groups.advanced].map(e => e.githubFileName),
    [props.groups]
  );
  const active = useActiveSection(names);

  return (
    <nav className="sidebar" aria-label="Examples" data-testid="examples-toc">
      <div className="sidebar__overview">
        <a href="#intro">Overview</a>
        <a href="#installation">Install</a>
      </div>
      <p className="kicker">Basic</p>
      <TocList entries={props.groups.basic} active={active} />
      <p className="kicker">Advanced</p>
      <TocList entries={props.groups.advanced} active={active} offset={props.groups.basic.length} />
    </nav>
  );
};

/** the narrow layout's table of contents: a Basic / Advanced tab strip above the examples */
export const TocTabs = (props: { groups: TocGroups }) => {
  const [tab, setTab] = React.useState<keyof TocGroups>("basic");

  return (
    <nav className="toc-tabs" aria-label="Examples" data-testid="examples-toc">
      <div className="tabs" role="tablist" aria-label="Example groups">
        {(["basic", "advanced"] as const).map(group => (
          <button
            key={group}
            type="button"
            role="tab"
            id={`toc-tab-${group}`}
            aria-selected={tab === group}
            aria-controls={`toc-panel-${group}`}
            onClick={() => setTab(group)}
          >
            {group === "basic" ? "Basic" : "Advanced"} · {props.groups[group].length}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`toc-panel-${tab}`} aria-labelledby={`toc-tab-${tab}`}>
        <TocList
          entries={props.groups[tab]}
          active={null}
          offset={tab === "advanced" ? props.groups.basic.length : 0}
        />
      </div>
    </nav>
  );
};
