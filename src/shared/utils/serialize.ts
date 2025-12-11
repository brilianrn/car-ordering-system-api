/* eslint-disable-next-line */
export const serializeParam = (obj: Record<string, any>): string => {
  let resolveObj = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (obj[key] === undefined || obj[key] === null) {
      return;
    }
    resolveObj = { ...resolveObj, [key]: value };
  });

  const params = new URLSearchParams(resolveObj);

  return params.toString();
};

/* eslint-disable-next-line */
export const deserializeParam = (str: string): Record<string, any> => {
  const params = new URLSearchParams(str);
  const obj: Record<string, any> = {}; // eslint-disable-line

  params.forEach((value, key) => {
    obj[key] = value;
  });

  return obj;
};
