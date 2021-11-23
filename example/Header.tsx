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
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
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

export const UseFormioLogoSqIcon = (props: any) => (
  <svg
    width="240"
    height="240"
    version="1.1"
    viewBox="0 0 240 240"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g transform="translate(-198.24 -60.844)">
      <path d="m257.63 143.94 155.08-55.184-97.62 132.53z" fill="#98dfff" />
      <path d="m238.33 135.98 155.08-55.184-97.62 132.53z" fill="#5dd2ff" />
      <path d="m219.02 128.03 155.08-55.184-97.62 132.53z" fill="#00a9ff" />
    </g>
    <g transform="translate(-198.24 -60.844)">
      <path d="m228.57 284.79h-7.1124v-1.0918q-2.4644 0.40554-4.96 0.81107-3.0259 0.46792-4.9912 0.46792-3.8994 0-3.8994-3.8994v-27.795h7.0812v25.58l6.7693-0.15598v-25.424h7.1124z" />
      <path d="m253.55 280.89q0 3.8994-3.9617 3.8994h-12.01q-3.9617 0-3.9617-3.8994v-6.7693h6.8317v5.3031h6.2702v-4.9912l-10.949-6.4573q-2.1524-1.279-2.1524-3.4314v-7.362q0-3.8994 4.0241-3.8994h11.885q3.9617 0 3.9617 3.8994v6.3326h-6.7693v-4.8664h-6.2702v4.5544l10.918 6.3949q2.1836 1.2478 2.1836 3.4938z" />
      <path d="m278.91 280.89q0 3.8994-4.0241 3.8994h-12.322q-4.0241 0-4.0241-3.8994v-23.708q0-3.8994 4.0241-3.8994h12.322q4.0241 0 4.0241 3.8994v11.573l-1.9653 1.9653h-11.573v8.8281h6.7069v-5.2407h6.8317zm-6.8317-14.818v-7.5492h-6.7069v7.5492z" />
      <path d="m304.4 242.42h-12.634v14.443h10.793v6.3326h-10.793v21.587h-7.2996v-48.82h19.933z" />
      <path d="m328.95 280.89q0 3.8994-3.9617 3.8994h-12.79q-4.0241 0-4.0241-3.8994v-23.708q0-3.8994 4.0241-3.8994h12.79q3.9617 0 3.9617 3.8994zm-6.9876-2.0277v-19.622h-6.7693v19.622z" />
      <path d="m353.97 266.44h-7.0812v-7.206l-5.6463 0.12478v25.424h-7.1436v-31.507h7.1436v1.1542q2.2148-0.40554 4.3985-0.81107 2.6516-0.46792 4.4297-0.46792 3.8994 0 3.8994 3.837z" />
      <path d="m392.74 284.79h-7.0812v-25.549l-6.7069 0.12478v25.424h-7.1124v-25.549l-6.7069 0.12478v25.424h-7.1436v-31.507h7.1436v1.1542q2.4956-0.40554 4.96-0.81107 3.0259-0.46792 5.0224-0.46792 2.4644 0 3.1819 1.4038 2.6204-0.40554 5.2407-0.84226 3.4626-0.56151 5.3031-0.56151 3.8994 0 3.8994 3.837z" />
      <path d="m405.13 248.76h-7.1436v-7.362h7.1436zm-0.0624 36.03h-7.0188v-31.507h7.0188z" />
      <path d="m431.15 280.89q0 3.8994-3.9618 3.8994h-12.79q-4.0241 0-4.0241-3.8994v-23.708q0-3.8994 4.0241-3.8994h12.79q3.9618 0 3.9618 3.8994zm-6.9876-2.0277v-19.622h-6.7693v19.622z" />
    </g>
  </svg>
);

export const UseFormioLogoOnlySqIcon = (props: any) => (
  <svg
    width="240"
    height="240"
    version="1.1"
    viewBox="0 0 240 240"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g transform="matrix(1.1333 0 0 1.1333 -238.91 -44.418)">
      <path d="m257.63 143.94 155.08-55.184-97.62 132.53z" fill="#98dfff" />
      <path d="m238.33 135.98 155.08-55.184-97.62 132.53z" fill="#5dd2ff" />
      <path d="m219.02 128.03 155.08-55.184-97.62 132.53z" fill="#00a9ff" />
    </g>
  </svg>
);

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
