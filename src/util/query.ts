import { warn } from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = (c: string) => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = (str: string) => encodeURIComponent(str)
  .replace(encodeReserveRE, encodeReserveReplacer)
  .replace(commaRE, ',')

const decode = decodeURIComponent

export function resolveQuery(
  query?: string,
  extraQuery: Route.query = {},
  _parseQuery?: (query: string) => Route.query,
): Route.query {
  const parse = _parseQuery || parseQuery
  let parsedQuery: Route.query
  try {
    parsedQuery = parse(query || '')
  } catch (e) {
    // tslint:disable-next-line:no-unused-expression
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  Object.keys(extraQuery).forEach((key) => {
    parsedQuery[key] = extraQuery[key]
  });
  return parsedQuery
}

function parseQuery(query: string): Route.query {
  const res: Route.query = {}

  query = query.trim().replace(/^(\?|#|&)/, '')

  if (!query) {
    return res
  }

  query.split('&').forEach((param) => {
    const parts = param.replace(/\+/g, ' ').split('=')
    const key = decode(parts.shift() || '')
    const val = parts.length > 0
      ? decode(parts.join('='))
      : null

    if (res[key] === undefined) {
      res[key] = val
    } else if (Array.isArray(res[key])) {
      (res[key] as any[]).push(val)
    } else {
      res[key] = [res[key] as string, val]
    }
  })

  return res
}

export function stringifyQuery(obj: Route.query): string {
  const res = obj ? Object.keys(obj).map((key) => {
    const val = obj[key]

    if (val === undefined) {
      return ''
    }

    if (val === null) {
      return encode(key)
    }

    if (Array.isArray(val)) {
      const result: string[] = []
      val.forEach((val2) => {
        if (val2 === undefined) {
          return
        }
        if (val2 === null) {
          result.push(encode(key))
        } else {
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      return result.join('&')
    }

    return encode(key) + '=' + encode(val)
  }).filter((x) => x.length > 0).join('&') : null
  return res ? `?${res}` : ''
}
