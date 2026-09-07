import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

/** the three layered triangles of the logo */
export const LogoMark = (props: IconProps) => (
  <svg viewBox="0 0 240 240" aria-hidden="true" {...props}>
    <g transform="matrix(1.1333 0 0 1.1333 -238.91 -44.418)">
      <path d="m257.63 143.94 155.08-55.184-97.62 132.53z" fill="#98dfff" />
      <path d="m238.33 135.98 155.08-55.184-97.62 132.53z" fill="#5dd2ff" />
      <path d="m219.02 128.03 155.08-55.184-97.62 132.53z" fill="#00a9ff" />
    </g>
  </svg>
);

/** the nine glyphs of the "useFormio" wordmark, straight out of assets/useformio-horizontal.svg */
const WORDMARK_PATHS = [
  "m239.9 300.82h-12.508v-1.92q-4.3338 0.71316-8.7225 1.4263-5.3213 0.82288-8.7773 0.82288-6.8573 0-6.8573-6.8573v-48.879h12.453v44.984l11.904-0.27429v-44.71h12.508z",
  "m283.85 293.97q0 6.8573-6.967 6.8573h-21.12q-6.967 0-6.967-6.8573v-11.904h12.014v9.3259h11.027v-8.7773l-19.255-11.356q-3.7852-2.2492-3.7852-6.0344v-12.947q0-6.8573 7.0767-6.8573h20.901q6.967 0 6.967 6.8573v11.136h-11.904v-8.5579h-11.027v8.0093l19.2 11.246q3.8401 2.1943 3.8401 6.1441z",
  "m328.45 293.97q0 6.8573-7.0767 6.8573h-21.669q-7.0767 0-7.0767-6.8573v-41.692q0-6.8573 7.0767-6.8573h21.669q7.0767 0 7.0767 6.8573v20.352l-3.4561 3.4561h-20.352v15.525h11.795v-9.2162h12.014zm-12.014-26.058v-13.276h-11.795v13.276z",
  "m373.26 226.32h-22.218v25.399h18.981v11.136h-18.981v37.962h-12.837v-85.853h35.055z",
  "m416.44 293.97q0 6.8573-6.967 6.8573h-22.492q-7.0767 0-7.0767-6.8573v-41.692q0-6.8573 7.0767-6.8573h22.492q6.967 0 6.967 6.8573zm-12.288-3.5658v-34.506h-11.904v34.506z",
  "m460.43 268.57h-12.453v-12.672l-9.9294 0.21943v44.71h-12.563v-55.407h12.563v2.0298q3.895-0.71316 7.735-1.4263 4.663-0.82288 7.7899-0.82288 6.8573 0 6.8573 6.7476z",
  "m528.62 300.82h-12.453v-44.929l-11.795 0.21943v44.71h-12.508v-44.929l-11.795 0.21943v44.71h-12.563v-55.407h12.563v2.0298q4.3887-0.71316 8.7225-1.4263 5.3213-0.82288 8.8322-0.82288 4.3338 0 5.5956 2.4686 4.6081-0.71316 9.2162-1.4812 6.0893-0.98745 9.3259-0.98745 6.8573 0 6.8573 6.7476z",
  "m550.4 237.46h-12.563v-12.947h12.563zm-0.10972 63.361h-12.343v-55.407h12.343z",
  "m596.15 293.97q0 6.8573-6.967 6.8573h-22.492q-7.0767 0-7.0767-6.8573v-41.692q0-6.8573 7.0767-6.8573h22.492q6.967 0 6.967 6.8573zm-12.288-3.5658v-34.506h-11.904v34.506z"
];

/** the "useFormio" wordmark, cropped out of assets/useformio-horizontal.svg, in currentColor */
export const LogoWordmark = (props: IconProps) => (
  <svg viewBox="176 57 398 82" fill="currentColor" role="img" aria-label="useFormio" {...props}>
    <g transform="translate(-25.476 -165.32)">
      {WORDMARK_PATHS.map(d => (
        <path key={d} d={d} />
      ))}
    </g>
  </svg>
);

/**
 * The full horizontal logo (`assets/useformio-horizontal.svg`: mark + wordmark, 580x160), the
 * hero's main visual. Inlined rather than `<img>`-ed so the wordmark can be `currentColor` - the
 * file's wordmark is plain black and would vanish on the dark theme.
 */
export const LogoHorizontal = (props: IconProps) => (
  <svg viewBox="0 0 580 160" role="img" aria-label="useFormio" {...props}>
    <g transform="translate(-25.476 -165.32)">
      <path d="m72.088 242.42 155.08-55.184-97.62 132.53z" fill="#98dfff" />
      <path d="m52.782 234.46 155.08-55.184-97.62 132.53z" fill="#5dd2ff" />
      <path d="m33.476 226.5 155.08-55.184-97.62 132.53z" fill="#00a9ff" />
    </g>
    <g transform="translate(-25.476 -165.32)" fill="currentColor">
      {WORDMARK_PATHS.map(d => (
        <path key={d} d={d} />
      ))}
    </g>
  </svg>
);

export const GithubIcon = (props: IconProps) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const NpmIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 21C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5ZM6 18V6H18V18H15V9H12V18H6Z"
    />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
