/* @flow */

import { Router } from '../router'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor(router: Router, base?: string, fallback: boolean = false) {
    super(router, base)
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners() {
    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', () => {
      const current = this.router.currentRoute
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), (route: Route) => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      })
    })
  }

  push(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    const fromRoute = this.router.currentRoute
    this.transitionTo(location, (route: Route) => {
      pushHash(route.fullPath)
      handleScroll(this.router, route, fromRoute, false)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  replace(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    const fromRoute = this.router.currentRoute
    this.transitionTo(location, (route: Route) => {
      replaceHash(route.fullPath)
      handleScroll(this.router, route, fromRoute, false)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  go(n: number) {
    window.history.go(n)
  }

  ensureURL(push?: boolean) {
    const current = this.router.currentRoute.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  getCurrentLocation() {
    return getHash()
  }
}

function checkFallback(base: string) {
  const location = getLocation(base)
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

function ensureSlash(): boolean {
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path)
  return false
}

export function getHash(): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  const href = window.location.href
  const index = href.indexOf('#')
  return index === -1 ? '' : decodeURI(href.slice(index + 1))
}

function getUrl(path: string) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash(path: string) {
  if (supportsPushState) {
    pushState(getUrl(path))
  } else {
    window.location.hash = path
  }
}

function replaceHash(path: string) {
  if (supportsPushState) {
    replaceState(getUrl(path))
  } else {
    window.location.replace(getUrl(path))
  }
}
