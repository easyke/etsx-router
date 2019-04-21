import { Router } from './router'
import getLink from './components/link'
import getView from './components/view'

export const getRouter = (options: Router.Options = {}, framework: any) => {
  const router = new Router(options)
  if (framework && framework.Component && framework.createElement && framework.PropTypes) {
    router.Link = getLink(router, framework)
    router.View = getView(router, framework)
  }
  return router
}
export { Router, Router as default }
