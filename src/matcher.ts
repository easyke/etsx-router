import pathToRegexp from 'path-to-regexp'
import { Router } from './router'
import { assert, warn } from './util/warn'
import { cleanPath, normalizePath } from './util/path'
import { createRoute } from './util/route'
import { resolvePath } from './util/path'
import { fillParams } from './util/params'
import { normalizeLocation } from './util/location'

type PathToRegexpOptions = pathToRegexp.RegExpOptions & pathToRegexp.ParseOptions;
export function createMatcher(
  routes: Router.Config[],
  router: Router,
): Matcher {
  return new Matcher(routes, router)
}
export class Matcher {
  /**
   * name匹配地图
   */
  nameMap: Dictionary<RouteRecord>;
  /**
   * path匹配地图
   */
  pathMap: Dictionary<RouteRecord>;
  /**
   * 路径列表用于控制路径匹配优先级
   */
  pathList: string[];
  router: Router;
  public constructor(routes: Router.Config[], router: Router) {
    /**
     * 创建映射表
     */
    this.nameMap = Object.create(null)
    this.pathMap = Object.create(null)
    this.pathList = []
    this.router = router
    // 添加路由记录
    this.addRoutes(routes)
    this.match = this.match.bind(this)
    this.addRoutes = this.addRoutes.bind(this)
  }
  public addRoutes(routes: Router.Config[]): void {

    routes.forEach((route) => this.addRouteRecord(route))
    // 确保通配符路由始终在最后
    this.wildcardToEnd()
  }
  public match(
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: EtsxLocation,
  ): Route {
    // 序列化 url
    // 比如对于该 url 来说 /abc?foo=bar&baz=qux#hello
    // 会序列化路径为 /abc
    // 哈希为 #hello
    // 参数为 foo: 'bar', baz: 'qux'
    const location = normalizeLocation(raw, currentRoute, false, this.router)
    const { name } = location

    // 如果是命名路由，就判断记录中是否有该命名路由配置
    if (name) {
      const record = this.nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 没找到表示没有匹配的路由
      if (!record) return this._createRoute(void 0, location)
      const paramNames = record.keys
        .filter((key) => !key.optional)
        .map((key) => key.name)

      // 参数处理
      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      if (record) {
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return this._createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      // 非命名路由处理
      location.params = {}
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < this.pathList.length; i++) {
        // 查找记录
        const path = this.pathList[i]
        const record = this.pathMap[path]
        // 如果匹配路由，则创建路由
        if (matchRoute(record, location.path, location.params)) {
          return this._createRoute(record, location, redirectedFrom)
        }
      }
    }
    // 没有匹配的路由 no match
    return this._createRoute(void 0, location)
  }
  /**
   * 根据条件创建不同的路由
   */
  protected _createRoute(
    record: RouteRecord | undefined,
    location: EtsxLocation,
    redirectedFrom?: EtsxLocation,
  ): Route {
    if (record && record.redirect) {
      return this.redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return this.alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, this.router)
  }
  protected redirect(
    record: RouteRecord,
    location: EtsxLocation,
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, void 0, this.router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`,
        )
      }
      return this._createRoute(void 0, location)
    }

    const re = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = this.nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return this.match({
        _normalized: true,
        name,
        query,
        hash,
        params,
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return this.match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash,
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return this._createRoute(void 0, location)
    }
  }

  protected alias(
    record: RouteRecord,
    location: EtsxLocation,
    matchAs: string,
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = this.match({
      _normalized: true,
      path: aliasedPath,
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return this._createRoute(aliasedRecord, location)
    }
    return this._createRoute(void 0, location)
  }
  protected addRouteRecord(
    route: Router.Config,
    parent?: RouteRecord,
    matchAs?: string,
  ): void {
    // 获得路由配置下的属性
    const { path, name } = route
    if (process.env.NODE_ENV !== 'production') {
      assert(path != null, `"path" is required in a route configuration.`)
      assert(
        typeof route.component !== 'string',
        `route config "component" for path: ${String(path || name)} cannot be a ` +
        `string id. Use an actual component instead.`,
      )
    }

    const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
    // 格式化 url，替换 "/",同时补充父层path
    const normalizedPath = normalizePath(
      path,
      parent,
      pathToRegexpOptions.strict,
    )
    if (typeof route.caseSensitive === 'boolean') {
      // 如果为true，则regexp将区分大小写。（默认值：false）
      pathToRegexpOptions.sensitive = route.caseSensitive
    }
    // 创建记录规则
    const { keys, regex } = compileRouteRegex(normalizedPath, pathToRegexpOptions)
    let components: RouteRecord['components'] | undefined
    if (typeof route.components === 'object') {
      components = route.components
    } else if (route.component && typeof route.component === 'function') {
      components = { default: route.component }
    } else if (typeof route.component === 'object') {
      components = route.component
    } else {
      throw new Error('component or components must is class or object');
    }

    const async: RouteRecord['async'] = {};
    Object.keys(components).forEach((key) => {
      if (typeof route.async === 'boolean') {
        async[key] = route.async
      } else if (typeof route.async === 'object') {
        async[key] = route.async[key] || false
      } else {
        async[key] = false
      }
    })

    // 生成记录对象
    const record: RouteRecord = {
      path: normalizedPath,
      keys,
      regex,
      components,
      instances: {},
      name,
      parent,
      matchAs,
      redirect: route.redirect,
      beforeEnter: route.beforeEnter,
      meta: route.meta || {},
      props: route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props },
      async,
    }
    if (route.children) {
      // Warn if route is named, does not redirect and has a default child route.
      // If users navigate to this route by name, the default child will
      // not be rendered (GH Issue #629)
      if (process.env.NODE_ENV !== 'production') {
        if (route.name && !route.redirect && route.children.some((child) => /^\/?$/.test(child.path))) {
          warn(
            false,
            `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${route.name}'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`,
          )
        }
      }
      // 递归路由配置的 children 属性，添加路由记录
      route.children.forEach((child) => {
        const childMatchAs = matchAs ? cleanPath(`${matchAs}/${child.path}`) : void 0
        this.addRouteRecord(child, record, childMatchAs)
      })
    }
    // 如果路由有别名的话
    // 给别名也添加路由记录
    if (route.alias !== undefined) {
      const aliases = Array.isArray(route.alias)
        ? route.alias
        : [route.alias]

      aliases.forEach((alias) => {
        const aliasRoute = {
          path: alias,
          children: route.children,
          async: route.async,
        }
        this.addRouteRecord(
          aliasRoute,
          parent,
          record.path || '/', // matchAs
        )
      })
    }
    // 更新映射表
    if (!this.pathMap[record.path]) {
      this.pathList.push(record.path)
      this.pathMap[record.path] = record
    }
    // 命名路由添加记录
    if (name) {
      if (!this.nameMap[name]) {
        this.nameMap[name] = record
      } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
        warn(
          false,
          `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`,
        )
      }
    }
  }
  /**
   * 把通配符路由移到最后
   */
  protected wildcardToEnd(): void {
    for (let i = 0, l = this.pathList.length; i < l; i++) {
      if (this.pathList[i] === '*') {
        // 切出来，然后插入最后
        this.pathList.push(this.pathList.splice(i, 1)[0])
        l--
        i--
      }
    }
  }
}

function matchRoute(
  record: RouteRecord,
  path: string,
  params: Route.params,
): boolean {
  const m = path.match(record.regex)

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  for (let i = 1, len = m.length; i < len; ++i) {
    const key = record.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath(path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}

function compileRouteRegex(path: string, pathToRegexpOptions: PathToRegexpOptions): {
  keys: pathToRegexp.Key[];
  regex: RegExp;
} {
  // console.log('pathToRegexpOptions', pathToRegexpOptions, path === '', 555)
  const keys: pathToRegexp.Key[] = []
  const regex = pathToRegexp(path, keys, pathToRegexpOptions)
  // console.log('regex', regex)
  if (process.env.NODE_ENV !== 'production') {
    const check: any = Object.create(null)
    keys.forEach((key) => {
      warn(!check[key.name], `Duplicate param keys in route with path: "${path}"`)
      check[key.name] = true
    })
  }
  return { keys, regex }
}
