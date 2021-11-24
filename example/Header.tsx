import * as React from "react";
import { BG_CODE_COLOR } from ".";
import { Container, NavLink, Navbar, NavbarBrand, NavbarText, NavbarToggler } from "reactstrap";
import { GithubIcon, NpmIcon, UseFormioLogoOnlySqIcon } from "./icons";
import { useWindowDimensions } from "./hooks";

export const Header = (props: {
  basicExamples: {
    title: string;
    githubFileName: string;
  }[];
  advancedExamples: {
    title: string;
    githubFileName: string;
  }[];
}) => {
  const dim = useWindowDimensions();

  const showCodeRight = dim.width > 1200;
  return (
    <div style={{ background: "#f8f9fa" }}>
      <Container style={showCodeRight ? { marginRight: 0 } : {}}>
        <Navbar color="light" expand="md" style={{ background: BG_CODE_COLOR }}>
          <NavbarBrand href="/">
            <UseFormioLogoOnlySqIcon width={50} height={50} />
          </NavbarBrand>
          <NavbarToggler onClick={function noRefCheck() {}} />
          <NavbarText style={{ display: "flex" }}>
            <NavLink target="_blank" href="https://npmjs.com/package/use-formio">
              <NpmIcon />
            </NavLink>
            <NavLink target="_blank" href="https://github.com/Svehla/use-formio">
              <GithubIcon />
            </NavLink>
          </NavbarText>
        </Navbar>
      </Container>
    </div>
  );
};
