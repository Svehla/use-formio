
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


const styles = {
  wrapper: { 

    marginLeft: '3rem',
    marginRight: '3rem',
  }
}

  
const App = () => {
  return (
    <div style={styles.wrapper}>
      <h1>useFormio docs</h1>

      <div>
        <h1>Readme examples</h1>

        <div>
          <h2>SyncValidations</h2>
          <SyncValidations />
        </div>
        <hr />
        <div>
          <h2>InputConstrains (shouldChangeValue)</h2>
          <InputConstrains />
        </div>
        <hr />
        <div>
          <h2>CrossValidations</h2>
          <CrossValidations />
        </div>
        <hr />
        <div>
          <h2>SyncSetValuesBasedOnPrevValue</h2>
          <SyncSetValuesBasedOnPrevValue />
        </div>
        <hr />
        <div>
          <h2>AsyncValidations</h2>
          <AsyncValidations />
        </div>
        <hr />
        <div>
          <h2>StableMethodPointers (useMemo)</h2>
          <StableMethodPointers />
        </div>
        <hr />
        <div>
          <h2>RevertToInitState</h2>
          <RevertToInitState />
        </div>
        <hr />
        <div>
          <h2>MultipleValidatorFunctions</h2>
          <MultipleValidatorFunctions />
        </div>
        
        <hr />
        <div>
          <h2>UseCombineFormioExample</h2>
          <UseCombineFormioExample />
        </div>

        <hr />
        
        <div>
          <h2>UncontrolledInput (+ React.memo optimization)</h2>
          <UncontrolledInput />
        </div>

      </div>
    </div>
  );
};



ReactDOM.render(<App />, document.getElementById('root'));

