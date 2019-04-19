import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'

export default (router, { Component, createElement, cloneElement, PropTypes }) => class RouterLink extends Component {
  static defaultProps = {
    tag: 'a',
    event: 'onClick'
  }
  static propTypes = {
    to: PropTypes.oneOfType([
      PropTypes.string.isRequired,
      PropTypes.object.isRequired
    ]),
    tag: PropTypes.string,
    exact: PropTypes.bool,
    append: PropTypes.bool,
    replace: PropTypes.bool,
    activeClass: PropTypes.string,
    exactActiveClass: PropTypes.string,
    event: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string)
    ])
  }

  render() {
    const { tag, href: hrefTo = '/', to = hrefTo, event = [], children: childrenOrigin, ...props } = this.props
    // 得到当前激活的 route 对象
    const current = router.currentRoute
    const { location, route, href } = router.resolve(to, current, props.append)

    const classes = {}
    const globalActiveClass = router.options.linkActiveClass
    const globalExactActiveClass = router.options.linkExactActiveClass
    // Support global empty active class
    const activeClassFallback = globalActiveClass == null
      ? 'router-link-active'
      : globalActiveClass
    const exactActiveClassFallback = globalExactActiveClass == null
      ? 'router-link-exact-active'
      : globalExactActiveClass
    const activeClass = props.activeClass == null
      ? activeClassFallback
      : props.activeClass
    const exactActiveClass = props.exactActiveClass == null
      ? exactActiveClassFallback
      : props.exactActiveClass
    const compareTarget = location.path
      ? createRoute(null, location, null, router)
      : route

    classes[exactActiveClass] = isSameRoute(current, compareTarget)
    classes[activeClass] = props.exact
      ? classes[exactActiveClass]
      : isIncludedRoute(current, compareTarget)

    const handler = e => {
      if (guardEvent(e)) {
        if (props.replace) {
          router.replace(location)
        } else {
          router.push(location)
        }
      }
    }

    props.className = Object.keys(classes).filter(name => classes[name]).join(' ')
    if (!props.className) {
      delete props.className
    }

    const on = { onClick: guardEvent }
    if (Array.isArray(event)) {
      event.forEach(e => { on[e] = handler })
    } else {
      on[event] = handler
    }

    props.href = href
    let children = childrenOrigin
    if (tag === 'a') {
      Object.assign(props, on)
      props.href = href
    } else {
      // find the first <a> child and apply listener and href
      const res = findAnchor(childrenOrigin, cloneElement, (a) => {
        if (cloneElement) {
          const { children, ...props } = a.props
          return cloneElement(a, Object.assign(props, on, { href }), [children])
          // a.props = Object.assign({}, a.props, on, { href })
        } else {
          Object.assign(a.props, on, { href })
          return a
        }
      })
      children = res.children
      if (!res.isFinded) {
        Object.assign(props, on)
      }
    }
    return createElement(tag, props, children)
  }
}

function guardEvent(e) {
  // 忽略带有功能键的点击，不要使用控制键重定向
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // 已阻止的返回，当preventDefault调用时，不要重定向
  if (e.defaultPrevented) return
  // 阻止右键单击
  if (e.button !== undefined && e.button !== 0) return
  // 如果`target ="_blank"`，忽略
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // 可能是一个Weex,没有这种方法
  if (e.preventDefault) {
    // 阻止默认行为 防止跳转
    e.preventDefault()
  }
  return true
}

function findAnchor(children, cloneElement, findCall, isFinded = false) {
  if (!isFinded && children) {
    if (Array.isArray(children)) {
      children = children.map(c => {
        const res = findAnchor(c, cloneElement, findCall, isFinded)
        isFinded = res.isFinded
        return res.children
      })
    } else if (children.type === 'a') {
      children = findCall(children)
      isFinded = true
    } else if (children.props && children.props.children) {
      const { children: childrenx, ...props } = children.props
      const res = findAnchor(childrenx, cloneElement, findCall, isFinded)
      if (cloneElement) {
        children = cloneElement(children, props, res.children)
      } else {
        children.children = res.children
      }
      isFinded = res.isFinded
    }
  }
  return {isFinded, children}
}
