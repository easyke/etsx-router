import { Router } from './router'

const getRouter = (options: Router.Options = {}) => new Router(options)

export {
  Router,
  Router as default,
  getRouter,
}
