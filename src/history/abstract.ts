
import { Router } from '../router'
import { History } from './base'

export class AbstractHistory extends History {
  index: number;
  stack: Route[];

  constructor(router: Router, base?: string) {
    super(router, base)
    this.stack = []
    this.index = -1
  }

  push(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    this.transitionTo(location, (route: Route) => {
      this.stack = this.stack.slice(0, this.index + 1).concat(route)
      this.index++
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  replace(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void {
    this.transitionTo(location, (route: Route) => {
      this.stack = this.stack.slice(0, this.index).concat(route)
      if (typeof onComplete === 'function') {
        onComplete(route)
      }
    }, onAbort)
  }

  go(n: number) {
    const targetIndex = this.index + n
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    const route = this.stack[targetIndex]
    this.confirmTransition(route, () => {
      this.index = targetIndex
      this.updateRoute(route)
    })
  }

  getCurrentLocation() {
    const current = this.stack[this.stack.length - 1]
    return current ? current.fullPath : '/'
  }

  ensureURL() {
    // noop
  }
}
