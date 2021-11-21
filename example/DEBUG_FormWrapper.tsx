import * as React from "react";
import { BG_CODE_COLOR } from "./constants";
import { Col } from "reactstrap";
import Highlight from "react-highlight";

const clearFormStateJSON = (json: any) => {
  const nJson = { ...json };
  delete nJson.__dangerous;

  // clear combineFormio nested fields
  if (nJson.forms) {
    nJson.forms = { ...nJson.forms };

    Object.entries(nJson.forms).forEach(([k, v]) => {
      // @ts-expect-error
      delete v.__dangerous;
    });
  }

  return nJson;
};

const styles = {
  col: {
    paddingTop: "2rem",
    paddingBottom: "2rem",
    background: BG_CODE_COLOR
  }
};
export const DEBUG_FormWrapper = (props: any) => {
  return (
    <>
      <Col md={6} style={styles.col}>
        <Highlight className="file-name.json">
          {JSON.stringify(clearFormStateJSON(props.form), null, 2)}
        </Highlight>
      </Col>

      <Col md={6}>{props.children}</Col>
    </>
  );
};
