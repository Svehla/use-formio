import * as React from "react";
import { BG_CODE_COLOR } from ".";
import {
  Collapse,
  Container,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  NavItem,
  NavLink,
  Navbar,
  NavbarBrand,
  NavbarText,
  NavbarToggler,
  UncontrolledDropdown
} from "reactstrap";
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
          <Collapse navbar>
            <Nav className="me-auto" navbar>
              <NavItem>
                <NavLink href="#installation">Installation</NavLink>
              </NavItem>
              <UncontrolledDropdown inNavbar nav>
                <DropdownToggle caret nav>
                  Examples
                </DropdownToggle>
                <DropdownMenu right>
                  {props.basicExamples.map(e => (
                    <DropdownItem key={e.githubFileName}>
                      <a href={`#${e.githubFileName}`}>{e.title}</a>
                    </DropdownItem>
                  ))}
                  <div style={{ paddingLeft: "16px" }}>Advanced</div>
                  {props.advancedExamples.map(e => (
                    <DropdownItem key={e.githubFileName}>
                      <a href={`#${e.githubFileName}`}>{e.title}</a>
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </UncontrolledDropdown>
            </Nav>
            <NavbarText>
              <NavLink target="_blank" href="https://npmjs.com/package/use-formio">
                <NpmIcon />
              </NavLink>
            </NavbarText>
            <NavbarText>
              <NavLink target="_blank" href="https://github.com/Svehla/use-formio">
                <GithubIcon />
              </NavLink>
            </NavbarText>
          </Collapse>
        </Navbar>
      </Container>
    </div>
  );
};
