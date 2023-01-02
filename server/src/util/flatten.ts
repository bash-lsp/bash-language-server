export function flattenArray<T>(nestedArray: T[][]): T[] {
  return nestedArray.reduce((acc, array) => [...acc, ...array], [])
}
