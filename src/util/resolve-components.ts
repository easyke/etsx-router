import { warn, isError } from './warn'

/**
 * 解析异步路由组件
 * @param matched 已经匹配的路由记录
 */
export function resolveAsyncComponents(matched: RouteRecord[]): Router.NavigationGuard {
  return (to, from, next) => {
    console.log('4444')
    let hasAsync = false
    let pending = 0
    let error: Error | null = null

    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        const resolve = once((resolvedDef) => {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          match.components[key] = resolvedDef
          pending--
          if (pending <= 0) {
            next()
          }
        })

        const reject = once((reason) => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          if (process.env.NODE_ENV !== 'production') {
            warn(false, msg)
          }
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        let res
        try {
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    if (!hasAsync) next()
  }
}
export function flatMapComponents<R>(
  matched: RouteRecord[],
  fn: (component: new () => any) => R,
): R[] {
  // 数组降维
  return flatten(matched.map((m) => {
    // 将组件中的对象传入回调函数中，获得钩子函数数组
    return Object.keys(m.components).map((key) => fn(
      m.components[key],
      m.instances[key],
      m,
      key,
    ))
  }))
}

/**
 * 数组降维 - 转为平行
 */
export function flatten<A = any>(arr: A[][]): A[] {
  return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

function isESModule(obj: any): boolean {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
type F<T> = (this: T, ...args: any[]) => any;
function once<T extends any = any>(fn: F<T>): F<T> {
  let called = false
  return function(this: T, ...args: any[]): any {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
