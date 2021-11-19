import * as React from 'react';


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
      <div style={styles.formWrapperForm}>
        {props.children}
      </div>
      <pre>{JSON.stringify(copy, null, 2)}</pre>
    </div>
  )
}
