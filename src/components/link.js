import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

export default (router, { Component, createElement, cloneElement, PropTypes }) => {
  
    function RouterLink() {
      return Component.apply(this, arguments) || this;
    }
    RouterLink.prototype = Object.create(Component.prototype); RouterLink.prototype.constructor = RouterLink; RouterLink.__proto__ = Component;
    var _proto = RouterLink.prototype;
  
    _proto.render = function render() {
      var _this$props = this.props,
          tag = _this$props.tag,
          _this$props$href = _this$props.href,
          hrefTo = _this$props$href === void 0 ? '/' : _this$props$href,
          _this$props$to = _this$props.to,
          to = _this$props$to === void 0 ? hrefTo : _this$props$to,
          _this$props$event = _this$props.event,
          event = _this$props$event === void 0 ? [] : _this$props$event,
          childrenOrigin = _this$props.children,
          props = _objectWithoutPropertiesLoose(_this$props, ["tag", "href", "to", "event", "children"]); // 得到当前激活的 route 对象
  
  
      var current = router.currentRoute;
  
      var _router$resolve = router.resolve(to, current, props.append),
          location = _router$resolve.location,
          route = _router$resolve.route,
          href = _router$resolve.href;
  
      var classes = {};
      var globalActiveClass = router.options.linkActiveClass;
      var globalExactActiveClass = router.options.linkExactActiveClass; // Support global empty active class
  
      var activeClassFallback = globalActiveClass == null ? 'router-link-active' : globalActiveClass;
      var exactActiveClassFallback = globalExactActiveClass == null ? 'router-link-exact-active' : globalExactActiveClass;
      var activeClass = props.activeClass == null ? activeClassFallback : props.activeClass;
      var exactActiveClass = props.exactActiveClass == null ? exactActiveClassFallback : props.exactActiveClass;
      var compareTarget = location.path ? createRoute(null, location, null, router) : route;
      classes[exactActiveClass] = isSameRoute(current, compareTarget);
      classes[activeClass] = props.exact ? classes[exactActiveClass] : isIncludedRoute(current, compareTarget);
  
      var handler = function handler(e) {
        if (guardEvent(e)) {
          if (props.replace) {
            router.replace(location);
          } else {
            router.push(location);
          }
        }
      };
  
      props.className = Object.keys(classes).filter(function (name) {
        return classes[name];
      }).join(' ');
  
      if (!props.className) {
        delete props.className;
      }
  
      var on = {
        onClick: guardEvent
      };
  
      if (Array.isArray(event)) {
        event.forEach(function (e) {
          on[e] = handler;
        });
      } else {
        on[event] = handler;
      }
  
      props.href = href;
      var children = childrenOrigin;
  
      if (tag === 'a') {
        Object.assign(props, on);
        props.href = href;
      } else {
        // find the first <a> child and apply listener and href
        var res = findAnchor(childrenOrigin, cloneElement, function (a) {
          if (cloneElement) {
            var _a$props = a.props,
                _children = _a$props.children,
                _props = _objectWithoutPropertiesLoose(_a$props, ["children"]);
  
            return cloneElement(a, Object.assign(_props, on, {
              href: href
            }), [_children]); // a.props = Object.assign({}, a.props, on, { href })
          } else {
            Object.assign(a.props, on, {
              href: href
            });
            return a;
          }
        });
        children = res.children;
  
        if (!res.isFinded) {
          Object.assign(props, on);
        }
      }
  
      return createElement(tag, props, children);
    };
  
    Object.assign(RouterLink, {
      defaultProps:{
        tag: 'a',
        event: 'onClick'
      },
      propTypes:{
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
    })
    return RouterLink;
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
