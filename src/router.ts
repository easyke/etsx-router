import pathToRegexp from 'path-to-regexp'
import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

export class Router  {

  fullpath: renderToString
  component: null | ComponentInterface
  createElement: null | Function
  RouterView: ComponentInterface
  forceUpdate: null | Function

  etsx: any;
  currentRoute: Router.Route;

  options: Router.Options
  mode: Router.mode;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Router.NavigationGuard[];
  resolveHooks: Router.NavigationGuard[];
  afterHooks: Router.AfterNavigationHook[];

  constructor(options?: Router.Options) {
    this.options = options || {}
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []

    this.fullpath = '/'
    this.component = options.defaultComponent || null
    this.forceUpdate = null
    this.createElement = options.createElement
    this.matcher = createMatcher(options.routes || [], this)
    this.RouterView = createRouterView(this)

    if (options.mode) {
      this.mode = options.mode
    } else if (isWeex) {
      this.mode = 'weex'
    } else if (inBrowser) {
      this.mode = 'history'
    } else {
      this.mode = 'abstract'
    }

    switch (this.mode) {
      // case 'weex':
      //   this.history = new WeexHistory(this, options.base)
      //   break
      // case 'history':
      //   this.history = new HTML5History(this, options.base)
      //   break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${this.mode}`)
        }
    }
    this.redirect(this.fullpath)
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
  redirect(fullpath) {
    if (fullpath == null) {
      return Promise.reject(new RouterError('fullpath cannot be empty', 'MUST_FULLPATH_REQUIRED'))
    }
    this.fullpath = fullpath
    return this.match(fullpath)
      .then((component) => {
        // 检查当前完整路径，避免路由器在延迟加载完成之前已更改
        if (fullpath === this.fullpath) {
          this.component = component
          if (typeof this.forceUpdate === 'function') {
            // 更新渲染
            return new Promise((resolve) => this.forceUpdate(resolve))
          }
        }
      }, (error) => {
        // 触发错误
        return this.errorHandler(error, { pathname: fullpath })
      })
  }
  addRoutes(routes: Router.config[]): void;
  getMatchedComponents(to?: RawLocation | Router.Route): Component[]
  match(fullpath: string): ComponentInterface {
    return this.matcher.match(fullpath)
  }
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
