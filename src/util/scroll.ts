import { Router } from '../router'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

const positionStore: { [key: string]: Router.Position } = Object.create(null)

export function setupScroll() {
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  window.history.replaceState({ key: getStateKey() }, '', window.location.href.replace(window.location.origin, ''))
  window.addEventListener('popstate', (e) => {
    saveScrollPosition()
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

export function handleScroll(
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean,
) {
  if (!router.app) {
    return
  }

  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    const position = getScrollPosition()
    const shouldScroll = behavior.call(router, to, from, isPop ? position : void 0)

    if (!shouldScroll) {
      return
    }

    if (typeof (shouldScroll as Promise<Router.PositionResult>).then === 'function') {
      (shouldScroll as Promise<Router.PositionResult>).then((shouldScroll: Router.PositionResult) => {
        scrollToPosition(shouldScroll, position)
      }).catch((err: any) => {
        if (process.env.NODE_ENV !== 'production') {
          assert(false, err.toString())
        }
      })
    } else {
      scrollToPosition(shouldScroll as Router.PositionResult, position)
    }
  })
}

export function saveScrollPosition() {
  const key = getStateKey()
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset,
    }
  }
}

function getScrollPosition(): Router.Position | undefined {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

function getElementPosition(el: Element, offset: Router.Position): Router.Position {
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y,
  }
}

function isValidPosition(obj: Router.Position): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition(obj: Router.Position): Router.Position {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset,
  }
}

function normalizeOffset(obj: Router.Position): Router.Position {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0,
  }
}

function isNumber(v: any): boolean {
  return typeof v === 'number'
}

function scrollToPosition(shouldScroll: Router.PositionResult, position?: Router.Position) {
  const isObject = typeof shouldScroll === 'object'
  if (isObject && typeof (shouldScroll as any).selector === 'string') {
    const el = document.querySelector((shouldScroll as any).selector)
    if (el) {
      let offset = (shouldScroll as any).offset && typeof (shouldScroll as any).offset === 'object' ? (shouldScroll as any).offset : {}
      offset = normalizeOffset(offset)
      position = getElementPosition(el, offset)
    } else if (isValidPosition(shouldScroll as Router.Position)) {
      position = normalizePosition(shouldScroll as Router.Position)
    }
  } else if (isObject && isValidPosition(shouldScroll as Router.Position)) {
    position = normalizePosition(shouldScroll as Router.Position)
  }

  if (position) {
    window.scrollTo(position.x, position.y)
  }
}
