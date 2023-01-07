/**
 * Flatten a 2-dimensional array into a 1-dimensional one.
 */
export function flattenArray<T>(nestedArray: T[][]): T[] {
  return nestedArray.reduce((acc, array) => [...acc, ...array], [])
}

/**
 * Remove all duplicates from the list.
 * Doesn't preserve ordering.
 */
export function uniq<A>(a: A[]): A[] {
  return Array.from(new Set(a))
}

/**
 * Removed all duplicates from the list based on the hash function.
 * First element matching the hash function wins.
 */
export function uniqueBasedOnHash<A extends Record<string, any>>(
  list: A[],
  elementToHash: (a: A) => string,
  __result: A[] = [],
): A[] {
  const result: typeof list = []
  const hashSet = new Set<string>()

  list.forEach((element) => {
    const hash = elementToHash(element)
    if (hashSet.has(hash)) {
      return
    }
    hashSet.add(hash)
    result.push(element)
  })

  return result
}
