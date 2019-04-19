/* @flow */

import { Router } from '../router'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  constructor(router: Router, base?: string) {
    super(router, base)

    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    const initLocation = getLocation(this.base)
    window.addEventListener('popstate', (e) => {
      const current = this.router.currentRoute

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.router.currentRoute === START && location === initLocation) {
        return
      }

      this.transitionTo(location, (route: Route) => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go(n: number) {
    window.history.go(n)
  }

  push(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    const fromRoute = this.router.currentRoute
    this.transitionTo(location, (route: Route) => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  replace(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    const fromRoute = this.router.currentRoute
    this.transitionTo(location, (route: Route) => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  ensureURL(push?: boolean) {
    if (getLocation(this.base) !== this.router.currentRoute.fullPath) {
      const current = cleanPath(this.base + this.router.currentRoute.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation(): string {
    return getLocation(this.base)
  }
}

export function getLocation(base: string): string {
  let path = decodeURI(window.location.pathname)
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}
