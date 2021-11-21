import * as React from "react";
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

export const GithubIcon = (props: any) => (
  <svg
    {...props}
    width="24px"
    height="24px"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="GitHub"
    role="img"
    viewBox="0 0 512 512"
  >
    <rect width="512" height="512" rx="15%" fill="#1B1817" />
    <path
      fill="#fff"
      // eslint-disable-next-line max-len
      d="M335 499c14 0 12 17 12 17H165s-2-17 12-17c13 0 16-6 16-12l-1-50c-71 16-86-28-86-28-12-30-28-37-28-37-24-16 1-16 1-16 26 2 40 26 40 26 22 39 59 28 74 22 2-17 9-28 16-35-57-6-116-28-116-126 0-28 10-51 26-69-3-6-11-32 3-67 0 0 21-7 70 26 42-12 86-12 128 0 49-33 70-26 70-26 14 35 6 61 3 67 16 18 26 41 26 69 0 98-60 120-117 126 10 8 18 24 18 48l-1 70c0 6 3 12 16 12z"
    />
  </svg>
);

const NpmIcon = (props: any) => (
  <svg
    {...props}
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      // eslint-disable-next-line max-len
      d="M5 21C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5ZM6 18V6H18V18H15V9H12V18H6Z"
      fill="black"
    />
  </svg>
);

export const Header = (props: {
  examples: {
    title: string;
    githubFileName: string;
  }[];
}) => {
  return (
    <Container>
      <Navbar color="light" expand="md" light>
        <NavbarBrand href="/">use-formio</NavbarBrand>
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
  );
};
