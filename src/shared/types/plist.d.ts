declare module 'plist' {
  export function parse(xml: string): unknown

  const plist: {
    parse: typeof parse
  }

  export default plist
}
