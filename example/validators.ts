const errRequiredMsg = "FIELD_IS_REQUIRED";

export const isRequired = (value: string | number | boolean) => {
  let isEmpty = false;
  if ((typeof value === "string" && value === null) || value === undefined || value === "") {
    isEmpty = true;
  } else if (typeof value === "number" && isNaN(value)) {
    isEmpty = true;
  }

  return isEmpty ? errRequiredMsg : undefined;
};

export const maxLen = (maxLenSize: number) => (value: string) => value.length <= maxLenSize;

export const isInteger = (val: string) => parseInt(val).toString() === val;