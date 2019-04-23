import pathToRegexp from 'path-to-regexp'
import { createMatcher, Matcher } from './matcher'
import { inBrowser } from './util/dom'
import { assert } from './util/warn'
import { cleanPath } from './util/path'
import { START } from './util/route'
import { supportsPushState } from './util/push-state'
import { normalizeLocation } from './util/location'
import getLink from './components/link'
import getView from './components/view'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

const isWeex = false

export class Router  {
  etsx: any;
  Link: any;
  View: any;
  options: Router.Options
  currentRoute: Route;
  mode: Router.mode;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  getLink: (router: Router, options: any) => any;
  getView: (router: Router, options: any) => any;
  fallback: boolean;
  beforeHooks: Router.NavigationGuard[];
  resolveHooks: Router.NavigationGuard[];
  afterHooks: Router.AfterNavigationHook[];

  constructor(options?: Router.Options) {
    this.options = options || {}
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    this.currentRoute = START
    /**
     * 创建路由映射表
     */
    this.matcher = createMatcher(this.options.routes || [], this)
    this.getLink = (options: any) => getLink(this, options)
    this.getView = (options: any) => getView(this, options)

    this.fallback = this.options.mode === 'history' && !supportsPushState && this.options.fallback !== false
    let mode: Router.mode | void
    if (this.options.mode) {
      mode = this.options.mode
    } else if (inBrowser) {
      mode = this.options.mode || 'history'
      if (this.fallback) {
        mode = 'hash'
      }
    }
    if (isWeex) {
      mode = 'weex'
    } else if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode || 'abstract'
    switch (this.mode) {
      // case 'weex':
      //   this.history = new WeexHistory(this, this.options.base)
      //   break
      case 'history':
        this.history = new HTML5History(this, this.options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, this.options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, this.options.base)
        break
      default:
        this.history = new AbstractHistory(this, this.options.base)
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${this.mode}`)
        }
    }
  }
  withRouter() {
  }
  init() {
    if (typeof this.history.init === 'function') {
      this.history.init()
    }
  }
  beforeEach(guard: Router.NavigationGuard): Router.unHook {
    return registerHook(this.beforeHooks, guard)
  }

  beforeResolve(guard: Router.NavigationGuard): Router.unHook {
    return registerHook(this.resolveHooks, guard)
  }

  afterEach(hook: Router.AfterNavigationHook): Router.unHook {
    return registerHook(this.afterHooks, hook)
  }

  onReady(cb: Router.ReadyHandler, errorCb?: Router.ErrorHandler): void {
    this.history.onReady(cb, errorCb)
  }

  onError(errorCb: Router.ErrorHandler): void {
    this.history.onError(errorCb)
  }

  push(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    this.history.push(location, onComplete, onAbort)
  }

  replace(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    this.history.replace(location, onComplete, onAbort)
  }
  /**
   * 去到
   * @param n 去到第几栈
   */
  go(n: number): void {
    this.history.go(n)
  }
  /**
   * 后退
   */
  back(): void {
    this.go(-1)
  }
  /**
   * 向前
   */
  forward(): void {
    this.go(1)
  }
  getMatchedComponents(to?: RawLocation | Route): any[] {
    const route: Route | void = to ? (to as Route).matched ? (to as Route) : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return ([] as any[]).concat.apply([], route.matched.map((m: RouteRecord) => Object.keys(m.components).map((key) => m.components[key])))
  }
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean,
  ): {
    location: EtsxLocation,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: EtsxLocation,
    resolved: Route,
  } {
    current = current || this.currentRoute
    const location = normalizeLocation(
      to,
      current,
      append,
      this,
    )
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route,
    }
  }
  /**
   * 路由匹配
   * @param raw 原始路径
   * @param current 当前路由
   * @param redirectedFrom 来源路由
   */
  match(
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: EtsxLocation,
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  addRoutes(routes: Router.Config[]) {
    this.matcher.addRoutes(routes)
    if (this.currentRoute !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

function createHref(base: string, fullPath: string, mode: Router.mode) {
  const path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

function registerHook(list: Array<Router.NavigationGuard | Router.AfterNavigationHook>, fn: Router.NavigationGuard | Router.AfterNavigationHook): Router.unHook {
  if (Array.isArray(list)) {
    list.push(fn)
    return () => {
      const i = list.indexOf(fn)
      if (i > -1) list.splice(i, 1)
    }
  } else {
    return () => { }
  }
}

export default Router
