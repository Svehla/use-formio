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
import { FormSchemaFramework } from './examples/FormSchemaFramework'
import { DebouncedInput } from './examples/DebouncedInput'
import Highlight from 'react-highlight'
import 'highlight.js/styles/atom-one-dark.css'
import 'bootstrap/dist/css/bootstrap.min.css';


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
  {
    title: 'DebouncedInput',
    githubFileName: 'DebouncedInput',
    Comp: DebouncedInput,
  },
  {
    
    title: 'FormSchemaFramework',
    githubFileName: 'FormSchemaFramework',
    Comp: FormSchemaFramework,
  }
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
    <div className="container">
      <h1>useFormio docs</h1>

      <div>
        <h1>Readme examples</h1>
        
        {components.map((i, index) => (
          <div key={index} >
            <ListItem item={i} sourceCode={data[i.githubFileName]}/>
          </div>
        ))}

      </div>
    </div>
  );
}; 

const ListItem = (props: any) => {
  const [show, setShow] = React.useState(false)
  const i = props.item

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between'}}>
        <h2>
          {i.title}
        </h2>
        <a href={`https://github.com/Svehla/use-formio/blob/main/example/examples/${i.githubFileName}.tsx`}>
          GITHUB
        </a>
      </div>

      <div>
        <i.Comp />
      </div>

      <div>
        <div>
          <button className="btn btn-primary" onClick={() => setShow(p => !p)}>
            {show ? 'hide' : 'show'} source code
          </button>
        </div>

        <div style={show ? undefined : { display: 'none' }}>
          <Highlight className='filename.tsx' >
            {props.sourceCode} 
          </Highlight>
        </div>

      </div>

      <hr />
    </div>
  )
}



ReactDOM.render(<App />, document.getElementById('root'));

