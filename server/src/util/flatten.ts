export function flattenArray<T>(nestedArray: Array<Array<T>>): Array<T> {
  return nestedArray.reduce((acc, array) => [...acc, ...array], [])
}

export function flattenObjectValues<T>(object: { [key: string]: Array<T> }): Array<T> {
  return flattenArray(Object.keys(object).map(objectKey => object[objectKey]))
}
