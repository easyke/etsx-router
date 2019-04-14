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
  errorCbs: Function[];

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

  onError(errorCb: Function) {
    this.errorCbs.push(errorCb)
  }

  transitionTo(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const route = this.router.match(location, this.current)
    this.confirmTransition(route, () => {
      this.updateRoute(route)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach((cb) => { cb(route) })
      }
    }, (err) => {
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach((cb) => { cb(err) })
      }
    })
  }

  confirmTransition(route: Route, onComplete: Router.CompleteHandler, onAbort?: Function) {
    const current = this.current
    const abort = (err) => {
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach((cb) => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      if (typeof onAbort === 'function') {
        onAbort(err)
      }
    }
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }

    const {
      updated,
      deactivated,
      activated,
    } = resolveQueue(this.current.matched, route.matched)

    const queue: Router.NavigationGuard[] = [].concat(
      // in-component leave guards
      extractLeaveGuards(deactivated),
      // global before hooks
      this.router.beforeHooks,
      // in-component update hooks
      extractUpdateHooks(updated),
      // in-config enter guards
      activated.map((m) => m.beforeEnter),
      // async components
      resolveAsyncComponents(activated),
    )

    this.pending = route
    const iterator = (hook: Router.NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
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
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
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
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
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
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard(
  def: Object | Function,
  key: string,
): NavigationGuard | NavigationGuard[] {
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

function bindGuard(guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
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
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Function[],
  isValid: () => boolean,
): NavigationGuard {
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
