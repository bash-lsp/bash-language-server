/**
 * Flatten a 2-dimensional array into a 1-dimensional one.
 */
export function flatten<A>(xs: A[][]): A[] {
  return xs.reduce((a, b) => a.concat(b), [])
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
 */
export function uniqueBasedOnHash<A>(list: A[], elementToHash: (a: A) => string): A[] {
  const hashSet = new Set()

  return list.reduce((accumulator, currentValue) => {
    const hash = elementToHash(currentValue)
    if (hashSet.has(hash)) {
      return accumulator
    }
    hashSet.add(hash)

    return [...accumulator, currentValue]
  }, [])
}
