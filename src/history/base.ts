import { Router } from '../router'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents,
} from '../util/resolve-components'
type postEnterCb = () => void;
export abstract class History {
  router: Router;
  base: string;
  pending?: Route;
  cb: Router.listenCallback;
  ready: boolean;
  readyCbs: Router.ReadyHandler[];
  readyErrorCbs: Router.ErrorHandler[];
  errorCbs: Router.ErrorHandler[];

  // implemented by sub-classes
  abstract go(n: number): void;
  abstract push(loc: RawLocation): void;
  abstract replace(loc: RawLocation): void;
  abstract ensureURL(push?: boolean): void;
  abstract getCurrentLocation(): string;

  constructor(router: Router, base?: string) {
    this.router = router
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    this.router.currentRoute = START
    this.pending = void 0
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
    this.cb = () => void 0
  }

  listen(cb: Router.listenCallback) {
    this.cb = cb
  }

  onReady(cb: Router.ReadyHandler, errorCb?: Router.ErrorHandler): void {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError(errorCb: Router.ErrorHandler) {
    this.errorCbs.push(errorCb)
  }
  /**
   * 路由跳转
   * @param location 地址
   * @param onComplete 完成时
   * @param onAbort 取消
   */
  transitionTo(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler) {
    // 获取匹配的路由信息
    const route = this.router.match(location, this.router.currentRoute)
    // 确认切换路由
    this.confirmTransition(route, () => {
      /**
       * 以下为切换路由成功或失败的回调
       * 更新路由信息，对组件的 _route 属性进行赋值，触发组件渲染
       * 调用 afterHooks 中的钩子函数
       */
      this.updateRoute(route)
      if (typeof onComplete === 'function') {
        // 如果有完成，就触发完成回调
        onComplete(route)
      }
      // 更新 URL
      this.ensureURL()

      /**
       * 只执行一次 ready 回调
       * fire ready cbs once
       */
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach((cb) => { cb(route) })
      }
    }, (err) => {
      // 错误处理
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach((cb) => { cb(err) })
      }
    })
  }
  /**
   * 确认切换路由
   * @param route
   * @param onComplete
   * @param onAbort
   */
  confirmTransition(route: Route, onComplete: Router.CompleteHandler, onAbort?: Router.ErrorHandler) {
    const current = this.router.currentRoute
    // 定义中断跳转路由函数
    const abort = (err?: Error) => {
      if (err && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach((cb) => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          if (console) {
            // tslint:disable-next-line:no-console
            console.error(err)
          }
        }
      }
      if (typeof onAbort === 'function') {
        onAbort(err as Error)
      }
    }
    // 如果是相同的路由就不跳转
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }
    // 通过对比路由解析出可复用的组件，需要渲染的组件，失活的组件
    const {
      /**
       * 可复用的组件对应路由
       * 原因是，使用了同一个组件[类]，可以复用实例，直接调用钩子来刷新数据
       */
      updated,
      /**
       * 失活的组件对应路由
       * 因为组件以不再使用，需要销毁的部分
       */
      deactivated,
      /**
       * 需要渲染的组件对应路由
       * 因为，未曾使用过，需要全新加载使用
       */
      activated,
    } = resolveQueue(this.router.currentRoute.matched, route.matched)

    // 导航守卫数组
    const queue = ([] as Array<Router.NavigationGuard | void>).concat(
      // 失活的组件钩子 [in-component leave guards]
      extractLeaveGuards(deactivated),
      // 全局 beforeEach 钩子
      this.router.beforeHooks,
      // 在当前路由改变，但是该组件被复用时调用[in-component update hooks]
      extractUpdateHooks(updated),
      // 需要渲染组件 enter 守卫钩子[in-config enter guards]
      activated.map((m) => m.beforeEnter),
      // 解析异步路由组件[async components] - react 不建议支持Promise
      // resolveAsyncComponents(activated),
    )
    // 保存路由
    this.pending = route
    // 迭代器，用于执行 queue 中的导航守卫钩子
    const iterator = (hook: Router.NavigationGuard, next: (...args: any[]) => any) => {
      // 路由不相等就不跳转路由
      if (this.pending !== route) {
        return abort()
      }
      try {
        // 试图执行钩子
        hook(route, current, (to: any) => {
          /**
           * 只有执行了钩子函数中的 next，
           * 才会继续执行下一个钩子函数
           * 否则会暂停跳转
           * 以下逻辑是在判断 next() 中的传参
           */
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            // next('/') 或者 next({ path: '/' }) -> 重定向
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            // 也就是执行下面函数 runQueue 中的 step(index + 1)
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }
    // 经典的同步执行异步函数
    runQueue(queue, iterator, () => {
      const postEnterCbs: postEnterCb[] = []
      const isValid = () => this.router.currentRoute === route
      // 当所有异步组件加载完成后，会执行这里的回调，也就是 runQueue 中的 cb()
      // 接下来执行 需要渲染组件的导航守卫钩子
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards: Array<Router.NavigationGuard | void> = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        // 跳转完成
        if (this.pending !== route) {
          return abort()
        }
        this.pending = void 0
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach((cb) => { cb() })
          })
        }
      })
    })
  }

  updateRoute(route: Route) {
    const prev = this.router.currentRoute
    this.router.currentRoute = route
    if (this.cb) {
      this.cb(route)
    }
    this.router.afterHooks.forEach((hook) => hook && hook(route, prev))
  }
}

function normalizeBase(base?: string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

function resolveQueue(
  current: RouteRecord[],
  next: RouteRecord[],
): {
  updated: RouteRecord[],
  activated: RouteRecord[],
  deactivated: RouteRecord[],
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    // 当前路由路径和跳转路由路径不同时跳出遍历
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    // 可复用的组件对应路由
    updated: next.slice(0, i),
    // 需要渲染的组件对应路由
    activated: next.slice(i),
    // 失活的组件对应路由
    deactivated: current.slice(i),
  }
}

function extractGuards(
  records: RouteRecord[],
  name: string,
  bind: any,
  reverse?: boolean,
): Array<Router.NavigationGuard | void> {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = def.prototype && def.prototype[name]
    if (guard) {
      return bind(guard, instance, match, key)
    }
  })
  /**
   * 数组降维，并且判断是否需要翻转数组
   * 因为某些钩子函数需要从子执行到父
   */
  return flatten(reverse ? guards.reverse() : guards)
}

/**
 * 执行失活组件的钩子函数
 * 也就是销毁前的回调
 * 导航离开该组件的对应路由时调用
 * 可以访问组件实例 `this`
 */
function extractLeaveGuards(deactivated: RouteRecord[]): Array<Router.NavigationGuard | void> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}
/**
 * 使用了同一个组件[类]，可以复用实例，
 * 直接调用钩子来刷新数据
 * --
 * 在当前路由改变，但是该组件被复用时调用
 * 举例来说，对于一个带有动态参数的路径 /foo/:id，在 /foo/1 和 /foo/2 之间跳转的时候，
 * 由于会渲染同样的 Foo 组件，因此组件实例会被复用。而这个钩子就会在这个情况下被调用。
 * 可以访问组件实例 `this`
 */
function extractUpdateHooks(updated: RouteRecord[]): Array<Router.NavigationGuard | void> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

/**
 * 把钩子的`this`上下文绑定到要执行的`Component`实例中
 * @param guard 守卫钩子
 * @param instance 需要绑定是组件实例
 */
function bindGuard(guard: Router.NavigationGuard, instance?: Component): Router.NavigationGuard | void {
  if (instance) {
    return guard.bind(instance)
  }
}
/**
 * 在渲染该组件的对应路由被 confirm 前调用
 * 不！能！获取组件实例 `this`
 * 因为当守卫执行前，组件实例还没被创建
 *
 * @param activated
 * @param cbs
 * @param isValid
 */
function extractEnterGuards(
  activated: RouteRecord[],
  cbs: postEnterCb[],
  isValid: () => boolean,
): Array<Router.NavigationGuard | void> {
  return extractGuards(activated, 'beforeRouteEnter', (guard: Router.NavigationGuard, _: ComponentInstance, match: RouteRecord, key: string) => {
    return bindEnterGuard(guard, match, key, cbs, isValid)
  })
}

function bindEnterGuard(
  guard: Router.NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: postEnterCb[],
  isValid: () => boolean,
): Router.NavigationGuard {
  return function routeEnterGuard(to, from, next) {
    return guard(to, from, (cb) => {
      next(cb)
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
    })
  }
}

function poll(
  cb: any, // somehow flow cannot infer this is a function
  instances: Dictionary<ComponentInstance>,
  key: string,
  isValid: () => boolean,
) {
  if (
    instances[key] &&
    !(instances[key] as any)._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
