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

export const Header = (props: {
  examples: {
    title: string;
    githubFileName: string;
  }[];
}) => (
  <div style={{ background: "#f8f9fa" }}>
    <Container>
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
                {props.examples.map(e => (
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
