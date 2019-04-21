import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default (router, { Component, createElement, PropTypes }) => class RouterView extends Component {
  static defaultProps = {
    name: 'default'
  }
  static propTypes = {
    name: PropTypes.string
  }
  constructor(...args){
    super(...args)
    this.offForceUpdate = router.afterEach(() => this.forceUpdate && this.forceUpdate())
  }
  render() {
    const cache = this._routerViewCache || (this._routerViewCache = {})
    // resolve props
    const { name, children, ...props } = this.props
    // 得到当前激活的 route 对象
    const route = router.currentRoute
    
    const depth = 0
    const inactive = false

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      return createElement(cache[name], props, children)
    }

    const matched = route.matched[depth]
    // render empty node if no matched route
    if (!matched) {
      cache[name] = null
      return (createElement('div', props, '没有'))
      // return createElement()
    }

    const component = cache[name] = class extends matched.components[name]{
      componentWillMount(){
        matched.instances[name] = this
        if (super.componentWillMount) {
          return super.componentWillMount()
        }
      }
      componentWillUnmount(){
        matched.instances[name] = void 0
        if (super.componentWillUnmount) {
          return super.componentWillUnmount()
        }
      }
    }
    
    const propsToPass = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      Object.assign(props, propsToPass)
    }
    console.log('props', props)
    return createElement(component, props, children)
  }
  componentWillUnmount() {
    if (this.offForceUpdate) {
      this.offForceUpdate()
      this.offForceUpdate = void 0
    }
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
