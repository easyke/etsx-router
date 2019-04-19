import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default (router, { Component, createElement, PropTypes }) => class RouterView extends Component {
  static defaultProps = {
    name: 'default'
  }
  static propTypes = {
    name: PropTypes.string
  }

  render() {
    const cache = this._routerViewCache || (this._routerViewCache = {})
    const { name, children } = this.props
    // 得到当前激活的 route 对象
    const route = router.currentRoute
    
    
    // resolve props
    const props = {}
    const propsToPass = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      Object.assign(props, propsToPass)
    }

    return createElement(component, props, children)
  }
}

function resolveProps(route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}
