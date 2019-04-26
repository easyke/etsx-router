import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default (router, { Component, createElement, PropTypes }) => {
  function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }


function RouterView() {
  var _this;

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  _this = Component.call.apply(Component, [this].concat(args)) || this;
  _this.offForceUpdate = router.afterEach(function () {
    return _this.forceUpdate && _this.forceUpdate();
  });
  return _this;
}
RouterView.prototype = Object.create(Component.prototype);
RouterView.prototype.constructor = RouterView; RouterView.__proto__ = Component;

var _proto = RouterView.prototype;

_proto.render = function render() {
  var cache = this._routerViewCache || (this._routerViewCache = {}); // resolve props

  var _this$props = this.props,
      name = _this$props.name,
      children = _this$props.children,
      props = _objectWithoutPropertiesLoose(_this$props, ["name", "children"]); // 得到当前激活的 route 对象


  var route = router.currentRoute;
  props.route = route;
  props.router = router;
  var depth = 0;
  var inactive = false; // render previous view if the tree is inactive and kept-alive

  if (inactive) {
    return createElement(cache[name], props, children);
  }

  var matched = route.matched[depth]; // render empty node if no matched route

  if (!matched) {
    cache[name] = null;
    return createElement('div', props, '没有'); // return createElement()
  }

  var component = cache[name] =
  /*#__PURE__*/
  function (_matched$components$n) {

    _class.prototype = Object.create(_matched$components$n.prototype);
    _class.prototype.constructor = _class; _class.__proto__ = _matched$components$n;

    function _class() {
      return _matched$components$n.apply(this, arguments) || this;
    }

    var _proto2 = _class.prototype;

    _proto2.componentWillMount = function componentWillMount() {
      matched.instances[name] = this;

      if (_matched$components$n.prototype.componentWillMount) {
        return _matched$components$n.prototype.componentWillMount.call(this);
      }
    };

    _proto2.componentWillUnmount = function componentWillUnmount() {
      if (matched.instances[name] === this) {
        matched.instances[name] = void 0;
      }

      if (_matched$components$n.prototype.componentWillUnmount) {
        return _matched$components$n.prototype.componentWillUnmount.call(this);
      }
    };

    return _class;
  }(matched.components[name]);

  var propsToPass = resolveProps(route, matched.props && matched.props[name]);

  if (propsToPass) {
    // clone to prevent mutation
    Object.assign(props, propsToPass);
  }

  return createElement(component, props, children);
};

_proto.componentWillUnmount = function componentWillUnmount() {
  if (this.offForceUpdate) {
    this.offForceUpdate();
    this.offForceUpdate = void 0;
  }
};
Object.assign(RouterView, {
  defaultProps : {
    name: 'default'
  },
  propTypes: {
    name: PropTypes.string
  }
})
return RouterView;
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
