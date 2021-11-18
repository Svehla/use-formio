
import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  SyncValidations,
  InputConstrains,
  CrossValidations,
  SyncSetValuesBasedOnPrevValue,
  AsyncValidations,
  RevertToInitState,
  MultipleValidatorFunctions,
  UseCombineFormioExample,
  StableMethodPointers,
} from './ExamplesReadme'

const styles = {
  wrapper: { 

    marginLeft: '3rem',
    marginRight: '3rem',
  }
}

  
const App = () => {
  return (
    <div style={styles.wrapper}>
      <h1>useFormio</h1>

      <div>
        <h1>Readme examples</h1>

        <div>
          <h2>SyncValidations</h2>
          <SyncValidations />
        </div>
        <hr />
        <div>
          <h2>InputConstrains</h2>
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
          <h2>StableMethodPointers</h2>
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

      </div>
    </div>
  );
};



ReactDOM.render(<App />, document.getElementById('root'));

