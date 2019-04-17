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
export abstract class History {
  router: Router;
  base: string;
  current: Route;
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
    this.current = START
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
    const route = this.router.match(location, this.current)
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
    const current = this.current
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
      updated,
      deactivated,
      activated,
    } = resolveQueue(this.current.matched, route.matched)

    // 导航守卫数组
    const queue: Router.NavigationGuard[] = [].concat(
      // 失活的组件钩子 [in-component leave guards]
      extractLeaveGuards(deactivated),
      // 全局 beforeEach 钩子
      this.router.beforeHooks,
      // 在当前路由改变，但是该组件被复用时调用[in-component update hooks]
      extractUpdateHooks(updated),
      // 需要渲染组件 enter 守卫钩子[in-config enter guards]
      activated.map((m) => m.beforeEnter),
      // 解析异步路由组件[async components]
      resolveAsyncComponents(activated),
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
      const postEnterCbs = []
      const isValid = () => this.current === route
      // 当所有异步组件加载完成后，会执行这里的回调，也就是 runQueue 中的 cb()
      // 接下来执行 需要渲染组件的导航守卫钩子
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards: Router.NavigationGuard[] = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        // 跳转完成
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
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
    const prev = this.current
    this.current = route
    this.cb && this.cb(route)
    this.router.afterHooks.forEach((hook) => {
      hook && hook(route, prev)
    })
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
  bind: Function,
  reverse?: boolean,
): Array<?Function> {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = extractGuard(def, name)
    if (guard) {
      return Array.isArray(guard)
        ? guard.map((guard) => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  /**
   * 数组降维，并且判断是否需要翻转数组
   * 因为某些钩子函数需要从子执行到父
   */
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard(
  def: Object | Function,
  key: string,
): Router.NavigationGuard | Router.NavigationGuard[] {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

function extractLeaveGuards(deactivated: RouteRecord[]): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks(updated: RouteRecord[]): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard(guard: Router.NavigationGuard, instance: ?_Vue): ?Router.NavigationGuard {
  if (instance) {
    return function boundRouteGuard() {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards(
  activated: RouteRecord[],
  cbs: Function[],
  isValid: () => boolean,
): Array<?Function> {
  return extractGuards(activated, 'beforeRouteEnter', (guard, _, match, key) => {
    return bindEnterGuard(guard, match, key, cbs, isValid)
  })
}

function bindEnterGuard(
  guard: Router.NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Function[],
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
  instances: Object,
  key: string,
  isValid: () => boolean,
) {
  if (
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
