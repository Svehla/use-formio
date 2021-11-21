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

const clearFormStateJSON = (json: any) => {
  const nJson = { ...json };
  delete nJson.__dangerous;

  // clear combineFormio
  if (nJson.forms) {
    nJson.forms = { ...nJson.forms };

    Object.entries(nJson.forms).forEach(([k, v]) => {
      // @ts-expect-error
      delete v.__dangerous;
    });
  }

  return nJson;
};

export const DEBUG_FormWrapper = (props: any) => {
  return (
    <>
      <Col style={{ background: "rgb(41 44 52)" }}>
        <Highlight className="file-name.json">
          {`

${JSON.stringify(clearFormStateJSON(props.form), null, 2)}

          `}
        </Highlight>
      </Col>

      <Col key={1} style={styles.formWrapperForm}>
        {props.children}
      </Col>
    </>
  );
};
