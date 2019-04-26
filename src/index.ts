import { createMatcher, Matcher } from './matcher'
import { Router } from './router'

const getRouter = (options: Router.Options = {}) => new Router(options)

export {
  createMatcher,
  Matcher,
  Router,
  Router as default,
  getRouter,
}
