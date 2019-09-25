export function flattenArray<T>(nestedArray: T[][]): T[] {
  return nestedArray.reduce((acc, array) => [...acc, ...array], [])
}

export function flattenObjectValues<T>(object: { [key: string]: T[] }): T[] {
  return flattenArray(Object.keys(object).map(objectKey => object[objectKey]))
}
