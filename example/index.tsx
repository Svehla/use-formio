import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SyncValidations } from './examples/SyncValidations'
import { InputConstrains } from './examples/InputConstrains'
import { CrossValidations } from './examples/CrossValidations'
import { SyncSetValuesBasedOnPrevValue } from './examples/SyncSetValuesBasedOnPrevValue'
import { AsyncValidations } from './examples/AsyncValidations'
import { RevertToInitState } from './examples/RevertToInitState'
import { MultipleValidatorFunctions } from './examples/MultipleValidatorFunctions'
import { UseCombineFormioExample } from './examples/UseCombineFormioExample'
import { UncontrolledInput } from './examples/UncontrolledInput'
import { StableMethodPointers } from './examples/StableMethodPointers'
// import SyntaxHighlighter from 'react-syntax-highlighter';
// import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';


const styles = {
  wrapper: { 

    marginLeft: '3rem',
    marginRight: '3rem',
  }
}

const components = [
  {
    title: 'SyncValidations',
    githubFileName: 'SyncValidations',
    Comp: SyncValidations
  },
  {
    title: 'InputConstrains',
    githubFileName: 'InputConstrains',
    Comp: InputConstrains
  },
  {
    title: 'CrossValidations',
    githubFileName: 'CrossValidations',
    Comp: CrossValidations,
  },
  {
    title: 'SyncSetValuesBasedOnPrevValue',
    githubFileName: 'SyncSetValuesBasedOnPrevValue',
    Comp: SyncSetValuesBasedOnPrevValue,
  },
  {
    title: 'AsyncValidations',
    githubFileName: 'AsyncValidations',
    Comp: AsyncValidations,
  },
  {
    title: 'RevertToInitState',
    githubFileName: 'RevertToInitState',
    Comp: RevertToInitState,
  },
  {
    title: 'MultipleValidatorFunctions',
    githubFileName: 'MultipleValidatorFunctions',
    Comp: MultipleValidatorFunctions,
  },
  {
    title: 'UseCombineFormioExample',
    githubFileName: 'UseCombineFormioExample',
    Comp: UseCombineFormioExample,
  },
  {
    title: 'UncontrolledInput',
    githubFileName: 'UncontrolledInput',
    Comp: UncontrolledInput,
  },
  {
    title: 'StableMethodPointers',
    githubFileName: 'StableMethodPointers',
    Comp: StableMethodPointers,
  },
]
  
const App = () => {
  const [data, setData] = React.useState({})

  React.useEffect(() => {

    (async () => {
      const res = await Promise.all(components.map(async (i) => ({
        name: i.githubFileName,
        data: await window
          .fetch(`https://raw.githubusercontent.com/Svehla/use-formio/main/example/examples/${i.githubFileName}.tsx`)
          .then(res => res.text())
        }
      )))


      setData(Object.fromEntries(res.map(i => [i.name, i.data])))
    })()

  }, [])

  return (
    <div style={styles.wrapper}>
      <h1>useFormio docs</h1>

      <div>
        <h1>Readme examples</h1>
        
        {components.map((i, index) => (
          <div key={index} >
            <h2>{i.title}</h2>
            <div>
              <a href={`https://github.com/Svehla/use-formio/blob/main/example/examples/${i.githubFileName}.tsx`}>
                GITHUB SOURCE CODE
              </a>
              <a href={`https://raw.githubusercontent.com/Svehla/use-formio/blob/main/example/examples/${i.githubFileName}.tsx`}>
                raw
              </a>
            </div>
            <div style={{ display: 'flex' }}>

              <i.Comp />

              <pre>
                {data[i.githubFileName]}
              </pre>
              {/* <SyntaxHighlighter language="javascript" style={docco}>
              </SyntaxHighlighter> */}
            </div>

            <hr />
          </div>
        ))}

      </div>
    </div>
  );
};



ReactDOM.render(<App />, document.getElementById('root'));

