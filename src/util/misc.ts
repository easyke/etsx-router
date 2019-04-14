export function extend<O extends Dictionary<any>>(a: O, b?: O): O {
  if (b) {
    Object.keys(b).forEach((key) => {
      a[key] = b[key]
    })
  }
  return a
}
