import * as React from 'react';
import Highlight from 'react-highlight'

const styles = {
  formWrapper: {
    display: 'flex',
    alignItems: 'flex-start'
  },
  redColor: {
    color: "red" 
  },
  formWrapperForm: {
    marginRight: '3rem'
  }
}

export const DEBUG_FormWrapper = (props: any) => {
  const copy = props.form
  delete copy.__dangerous

  return (
    <div style={styles.formWrapper}>
      <div className="col-6" style={styles.formWrapperForm}>
        {props.children}
      </div>
      
      <div className="col-6">
        <Highlight  className='xd.json'>
          {JSON.stringify(copy, null, 2)}
        </Highlight>
      </div>
    </div>
  )
}
