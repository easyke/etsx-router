import { Router } from './index.d'

function createRouterView(router: Router) {
   function RouterView(props, context, updater) {
    this.router = router;
    this.props = props;
    this.context = context;
    this.updater = updater;
    if (this.router) {
      this.router.forceUpdate = (callback) => updater.forceUpdate(this, callback);
    }
  }
   RouterView.prototype = {
    /**
     * 在组件从 DOM 中移除之前立刻被调用
     */
    componentWillUnmount(): void {
      if (this.router) {
        this.router.forceUpdate = null
      }
    },
    render() {
      return router.createElement(router.component || 'div', this.props)
    },
  }
   return RouterView
}

export {
  createRouterView,
  createRouterView as default,
}
