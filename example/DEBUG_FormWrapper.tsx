import * as React from "react";
import { Col } from "reactstrap";
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
    <>
      <Col style={{ background: "rgb(41 44 52)" }}>
        <Highlight className="file-name.json">
          {`

${JSON.stringify(copy1, null, 2)}

          `}
        </Highlight>
      </Col>

      <Col key={1} style={styles.formWrapperForm}>
        {props.children}
      </Col>

      {/* <div className="col-md-5">
        {copy2 && (
          <Highlight className="file-name.json">{JSON.stringify(copy2, null, 2)}</Highlight>
        )}
      </div> */}
    </>
  );
};
