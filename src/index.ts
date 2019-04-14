
import { createMatcher, Matcher } from './create-matcher'
import { createRouterView } from './create-router-view'
import { History, RouterOptions, Router as RouterInterface, Component as ComponentInterface } from './index.d'
import { RouterError } from './error'
import { AbstractHistory } from './history/abstract'
import { assert } from './util/warn'
// import { HTML5History } from './history/html5'
// import { WeexHistory } from './history/weex'
const inBrowser = typeof window !== 'undefined'
declare var process: NodeJS.Process;

class Router implements RouterInterface {
  app: Object;
  options: RouterOptions
  fullpath: string
  matcher: Matcher
  history: History
  component: null | ComponentInterface
  createElement: null | Function
  RouterView: ComponentInterface
  forceUpdate: null | Function
  beforeHooks: Function[]
  resolveHooks: Function[]
  afterHooks: Function[]
  mode: any;
  constructor(options?: RouterOptions) {
    this.options = options
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
    } else if (/* isWeex */false) {
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
  errorHandler(error, obj) {

  }
  beforeEach(fn) {
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve(fn) {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach(fn) {
    return registerHook(this.afterHooks, fn)
  }

  onReady(cb: Function, errorCb: Function): void {
    this.history.onReady(cb, errorCb)
  }

  onError(errorCb: Function): void {
    this.history.onError(errorCb)
  }

  push(location, onComplete, onAbort) {
    this.history.push(location, onComplete, onAbort)
  }

  replace(location, onComplete, onAbort) {
    this.history.replace(location, onComplete, onAbort)
  }

  go(n) {
    this.history.go(n)
  }

  back() {
    this.go(-1)
  }

  forward() {
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
  match(fullpath: string): ComponentInterface {
    return this.matcher.match(fullpath)
  }
}

function registerHook(list, fn) {
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
