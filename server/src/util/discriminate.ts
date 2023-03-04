export function discriminate<K extends PropertyKey, V extends string | number | boolean>(
  discriminantKey: K,
  discriminantValue: V,
) {
  return <T extends Record<K, any>>(
    obj: T & Record<K, V extends T[K] ? T[K] : V>,
  ): obj is Extract<T, Record<K, V>> => obj[discriminantKey] === discriminantValue
}
