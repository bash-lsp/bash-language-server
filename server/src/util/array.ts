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
