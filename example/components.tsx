import * as React from "react";
import Highlight from "react-highlight";

const styles = {
  formWrapper: {
    display: "flex",
    alignItems: "flex-start"
  },
  redColor: {
    color: "red"
  },
  formWrapperForm: {
    marginRight: "3rem"
  }
};

export const DEBUG_FormWrapper = (props: any) => {
  const copy1 = props.form;
  delete copy1.__dangerous;
  const copy2 = props.form2 ?? undefined;
  delete copy2?.__dangerous;

  return (
    <div className="row" style={styles.formWrapper}>
      <div className="col-md-3" style={styles.formWrapperForm}>
        {props.children}
      </div>

      <div className="col-md-4">
        <Highlight className="xd.json">{JSON.stringify(copy1, null, 2)}</Highlight>
      </div>

      {copy2 && (
        <div className="col-md-4">
          <Highlight className="xd.json">{JSON.stringify(copy2, null, 2)}</Highlight>
        </div>
      )}
    </div>
  );
};
