import "./global-styles.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "highlight.js/styles/atom-one-dark.css";
import "react-app-polyfill/ie11";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { AsyncValidations } from "./examples/AsyncValidations";
import { CrossValidations } from "./examples/CrossValidations";
import { CustomFormSchemaFramework } from "./examples/CustomFormSchemaFramework";
import { DebouncedInput } from "./examples/DebouncedInput";
import { GithubIcon, Header } from "./Header";
import { InputConstrains } from "./examples/InputConstrains";
import { MultipleValidatorFunctions } from "./examples/MultipleValidatorFunctions";
import { RevertToInitState } from "./examples/RevertToInitState";
import { StableMethodPointers } from "./examples/StableMethodPointers";
import { SyncSetValuesBasedOnPrevValue } from "./examples/SyncSetValuesBasedOnPrevValue";
import { SyncValidations } from "./examples/SyncValidations";
import { UncontrolledInput } from "./examples/UncontrolledInput";
import { UseCombineFormioExample } from "./examples/UseCombineFormioExample";
import Highlight from "react-highlight";

const examples = [
  {
    title: "Synchronous validations",
    githubFileName: "SyncValidations",
    Comp: SyncValidations
  },
  {
    title: "Input constrains",
    githubFileName: "InputConstrains",
    Comp: InputConstrains
  },
  {
    title: "Cross validations",
    githubFileName: "CrossValidations",
    Comp: CrossValidations
  },
  {
    title: "Sync set valuesBased on prev value",
    githubFileName: "SyncSetValuesBasedOnPrevValue",
    Comp: SyncSetValuesBasedOnPrevValue
  },
  {
    title: "Async validations",
    githubFileName: "AsyncValidations",
    Comp: AsyncValidations
  },
  {
    title: "Revert to init state",
    githubFileName: "RevertToInitState",
    Comp: RevertToInitState
  },
  {
    title: "Multiple validator functions",
    githubFileName: "MultipleValidatorFunctions",
    Comp: MultipleValidatorFunctions
  },
  {
    title: "Use combine formio example",
    githubFileName: "UseCombineFormioExample",
    Comp: UseCombineFormioExample
  },
  {
    title: "Uncontrolled input",
    githubFileName: "UncontrolledInput",
    Comp: UncontrolledInput
  },
  {
    title: "Stable method pointers",
    githubFileName: "StableMethodPointers",
    Comp: StableMethodPointers
  },
  {
    title: "Debounced input",
    githubFileName: "DebouncedInput",
    Comp: DebouncedInput
  },
  {
    title: "Custom form schema framework",
    githubFileName: "CustomFormSchemaFramework",
    Comp: CustomFormSchemaFramework
  }
];

const App = () => {
  const [data, setData] = React.useState({});

  React.useEffect(() => {
    (async () => {
      const res = await Promise.all(
        examples.map(async i => ({
          name: i.githubFileName,
          data: await window
            .fetch(
              // eslint-disable-next-line max-len
              `https://raw.githubusercontent.com/Svehla/use-formio/main/example/examples/${i.githubFileName}.tsx`
            )
            .then(res => res.text())
        }))
      );

      setData(Object.fromEntries(res.map(i => [i.name, i.data])));
    })();
  }, []);

  return (
    <div className="container">
      <div style={{ marginBottom: "4rem" }}>
        <Header examples={examples} />
      </div>

      <h1>useFormio</h1>

      <div style={{ marginBottom: "4rem" }}>
        <p>
          <b>use-formio</b> has 0 dependencies and less than 200 lines of code!
        </p>
        <p>
          This minimalist approach brings you proper level of abstraction to abstract heavy lifting
          form boilerplate React code.
        </p>
        <p>
          Each of your application deserves custom UI solution so it does not make sense to use
          separate library to handle form UIs.
        </p>
        <p>
          If your application needs to have tons of forms is really easy for programmers to make
          custom form configurable UI.
        </p>
        <p>
          In useFormio you just define custom business model and don{`'`}t waste a time with
          boilerplate around.
        </p>
        <p>
          At the top of this, useFormio package is different from the others with the uniq support
          of Typescript type inferring.
        </p>
        <p>
          You can write a huge form without writing any line of Typescript static types. Thanks to
          smart API we{`'`}re able to infer static types and keep code clean and safe without
          runtime-errors.
        </p>
      </div>

      <div style={{ marginBottom: "4rem" }}>
        <h2>Installation</h2>
        <code>npm install use-formio</code>
      </div>

      <h2>Examples</h2>

      {examples.map((i, index) => (
        <div key={index}>
          <ListItem item={i} sourceCode={data[i.githubFileName]} />
        </div>
      ))}
    </div>
  );
};

const ListItem = (props: { sourceCode: string; item: typeof examples[number] }) => {
  const [show, setShow] = React.useState(false);
  const i = props.item;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
        <a
          style={{ marginRight: "0.5rem" }}
          // eslint-disable-next-line max-len
          href={`https://github.com/Svehla/use-formio/blob/main/example/examples/${i.githubFileName}.tsx`}
        >
          <GithubIcon />
        </a>
        <h3 style={{ marginBottom: 0 }} id={i.githubFileName}>
          {i.title}
        </h3>
      </div>

      <div>
        <i.Comp />
      </div>

      <div>
        <div>
          <button className="btn btn-primary" onClick={() => setShow(p => !p)}>
            {show ? "hide" : "show"} example source code
          </button>
        </div>

        <div style={show ? undefined : { display: "none" }}>
          <Highlight className="filename.tsx">{props.sourceCode}</Highlight>
        </div>
      </div>

      <hr />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
