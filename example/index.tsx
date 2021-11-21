import "./global-styles.css";
import "bootstrap/dist/css/bootstrap.min.css";
// import "highlight.js/styles/hybrid.css";
import "highlight.js/styles/atom-one-dark.css";
import "react-app-polyfill/ie11";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { AsyncValidations } from "./examples/AsyncValidations";
import { Col, Container, Row } from "reactstrap";
import { CrossValidations } from "./examples/CrossValidations";
import { CustomFormSchemaFramework } from "./examples/CustomFormSchemaFramework";
import { DebouncedInput } from "./examples/DebouncedInput";
import { GithubIcon, Header } from "./Header";
import { InputConstrains } from "./examples/InputConstrains";
import { RevertToInitState } from "./examples/RevertToInitState";
import { StableMethodPointers } from "./examples/StableMethodPointers";
import { SyncSetValuesBasedOnPrevValue } from "./examples/SyncSetValuesBasedOnPrevValue";
import { SyncValidations } from "./examples/SyncValidations";
import { UncontrolledInput } from "./examples/UncontrolledInput";
import { UseCombineFormioExample } from "./examples/UseCombineFormioExample";

// TODO: add some plugin to parcel v1 to read .tsx files as txt somehow?
// generated files
import { raw_AsyncValidations } from "./__generated_examples__/AsyncValidations";
import { raw_CrossValidations } from "./__generated_examples__/CrossValidations";
import { raw_CustomFormSchemaFramework } from "./__generated_examples__/CustomFormSchemaFramework";
import { raw_DebouncedInput } from "./__generated_examples__/DebouncedInput";
import { raw_InputConstrains } from "./__generated_examples__/InputConstrains";
// eslint-disable-next-line max-len
import { raw_RevertToInitState } from "./__generated_examples__/RevertToInitState";
import { raw_StableMethodPointers } from "./__generated_examples__/StableMethodPointers";
// eslint-disable-next-line max-len
import { raw_SyncSetValuesBasedOnPrevValue } from "./__generated_examples__/SyncSetValuesBasedOnPrevValue";
import { raw_SyncValidations } from "./__generated_examples__/SyncValidations";
import { raw_UncontrolledInput } from "./__generated_examples__/UncontrolledInput";
import { raw_UseCombineFormioExample } from "./__generated_examples__/UseCombineFormioExample";

import { BG_CODE_COLOR } from "./constants";
import Highlight from "react-highlight";

const examples = [
  {
    title: "Synchronous validations",
    githubFileName: "SyncValidations",
    Comp: SyncValidations,
    code: raw_SyncValidations
  },
  {
    title: "Input constrains",
    githubFileName: "InputConstrains",
    Comp: InputConstrains,
    code: raw_InputConstrains
  },
  {
    title: "Cross validations",
    githubFileName: "CrossValidations",
    Comp: CrossValidations,
    code: raw_CrossValidations
  },
  {
    title: "Sync set valuesBased on prev value",
    githubFileName: "SyncSetValuesBasedOnPrevValue",
    Comp: SyncSetValuesBasedOnPrevValue,
    code: raw_SyncSetValuesBasedOnPrevValue
  },
  {
    title: "Async validations",
    githubFileName: "AsyncValidations",
    Comp: AsyncValidations,
    code: raw_AsyncValidations
  },
  {
    title: "Revert to init state",
    githubFileName: "RevertToInitState",
    Comp: RevertToInitState,
    code: raw_RevertToInitState
  },
  {
    title: "Use combine formio example",
    githubFileName: "UseCombineFormioExample",
    Comp: UseCombineFormioExample,
    code: raw_UseCombineFormioExample
  },
  {
    title: "Uncontrolled input",
    githubFileName: "UncontrolledInput",
    Comp: UncontrolledInput,
    code: raw_UncontrolledInput
  },
  {
    title: "Stable method pointers",
    githubFileName: "StableMethodPointers",
    Comp: StableMethodPointers,
    code: raw_StableMethodPointers
  },
  {
    title: "Debounced input",
    githubFileName: "DebouncedInput",
    Comp: DebouncedInput,
    code: raw_DebouncedInput
  },
  {
    title: "Custom form schema framework",
    githubFileName: "CustomFormSchemaFramework",
    Comp: CustomFormSchemaFramework,
    code: raw_CustomFormSchemaFramework
  }
];

const styles = {
  block: {
    marginBottom: "4rem"
  }
};

const App = () => {
  return (
    <div>
      <div style={styles.block}>
        <Header examples={examples} />
      </div>

      <Container style={{ marginBottom: "4rem" }}>
        <h1>useFormio</h1>

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
      </Container>

      <Container style={styles.block}>
        <h2>Installation</h2>
        <code>npm install use-formio</code>
      </Container>

      <Container style={styles.block}>
        <h2>Examples</h2>

        <div>
          {examples.map(e => (
            <div key={e.githubFileName}>
              <a href={`#${e.githubFileName}`}>{e.title}</a>
            </div>
          ))}
        </div>
      </Container>

      {examples.map((i, index) => (
        <div key={index}>
          <ListItem {...i} />
        </div>
      ))}
    </div>
  );
};

const getWindowDimensions = () => ({
  width: window.innerWidth,
  height: window.innerHeight
});

const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = React.useState(getWindowDimensions());

  React.useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
};

const ListItem = (props: typeof examples[number]) => {
  const [show, setShow] = React.useState(false);
  const i = props;

  const dim = useWindowDimensions();

  const showCodeRight = dim.width > 1200;

  return (
    <div>
      <Row>
        <Col>
          <Container style={showCodeRight ? { marginRight: 0 } : {}}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
              <a
                style={{ marginRight: "0.5rem" }}
                // eslint-disable-next-line max-len
                href={`https://github.com/Svehla/use-formio/blob/main/example/examples/${i.githubFileName}.tsx`}
              >
                <GithubIcon />
              </a>

              <a href={`#${i.githubFileName}`} style={{ textDecoration: "none" }}>
                <h3 style={{ marginBottom: 0 }} id={i.githubFileName}>
                  {i.title}
                </h3>
              </a>
            </div>

            <Row className="DEBUG_FormWrapper" style={{ alignItems: "stretch" }}>
              <i.Comp />
            </Row>
          </Container>
        </Col>

        {showCodeRight && (
          <Col xl={5} md={5} style={{ background: BG_CODE_COLOR }}>
            {/* <hr style={{ borderTop: "5px solid black" }} /> */}
            <div style={{ paddingBottom: "12rem" }}>
              <Highlight className="code-snippet filename.tsx">{i.code}</Highlight>
            </div>
          </Col>
        )}
      </Row>

      {showCodeRight === false && (
        <Container style={styles.block}>
          <div>
            <button className="btn btn-primary" onClick={() => setShow(p => !p)}>
              {show ? "hide" : "show"} example source code
            </button>
          </div>

          <div style={show ? undefined : { display: "none" }}>
            <Highlight className="filename.tsx">{i.code}</Highlight>
          </div>
          <hr />
        </Container>
      )}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
