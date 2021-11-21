const fs = require("fs");

if (!fs.existsSync("./__generated_examples__")) {
  fs.mkdirSync("./__generated_examples__");
}

const files = fs.readdirSync("./examples");

const processSourceCode = sourceCode => {
  return sourceCode
    ?.replace('"../../dist"', '"use-formio"')
    ?.replace('import { DEBUG_FormWrapper } from "../DEBUG_FormWrapper";\n', "")
    ?.replace("<DEBUG_FormWrapper form={form}>", "<div>")
    ?.replace("</DEBUG_FormWrapper>", "</div>");
};

files.forEach(fileName => {
  console.log(fileName);
  const file = fs.readFileSync(`./examples/${fileName}`, "utf-8");

  const newFileContent = `
export const raw_${fileName.split(".")[0]} = \`
${processSourceCode(file)}
\`
`;
  fs.writeFileSync(`./__generated_examples__/${fileName}`, newFileContent, "utf-8");
});
