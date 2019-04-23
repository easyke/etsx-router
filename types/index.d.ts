
declare class ComponentInstance {
  constructor(args: any[]);
}
declare type Component = ComponentInstance['constructor'];

declare type props = object

declare class RouteRegExp extends RegExp {
  keys: Array<{ name: string, optional: boolean }>;
}
declare type RoutePropsFunction = (route: Route) => props;
declare type EtsxLocation = {
  _normalized?: boolean;
  name?: string;
  path?: string;
  hash?: string;
  query?: Route.query;
  params?: Route.params;
  append?: boolean;
  replace?: boolean;
}
declare type RawLocation = string | EtsxLocation;
declare type Dictionary<T> = { [key: string]: T };

declare namespace Route {

  export type query = Dictionary<string | Array<string | null> | null | undefined>

  export type params = Dictionary<string>

  export type meta = any;
}
declare type Route = {
  /**
   * 字符串，对应当前路由的路径，总是解析为绝对路径
   * 如 "/foo/bar"。
   */
  path: string;
  /**
   * 当前路由的名称，如果有的话。
   */
  name?: string;
  hash: string;
  query: Route.query;
  params: Route.params;
  fullPath: string;
  /**
   * 一个数组，包含当前路由的所有嵌套路径片段的路由记录 。
   * 路由记录就是 routes 配置数组中的对象副本 (还有在 children 数组)。
   */
  matched: RouteRecord[];
  /**
   * 如果存在重定向，
   * 即为重定向来源的路由的名字。
   */
  redirectedFrom?: string;
  meta?: Route.meta;
}

declare type RouteRecord = {
  /**
   * 字符串，对应当前路由的路径，总是解析为绝对路径
   * 如 "/foo/bar"。
   */
  path: string;
  regex: RegExp;
  keys: any[];
  components: Dictionary<Component>;
  async: Dictionary<boolean>;
  instances: Dictionary<ComponentInstance>;
  /**
   * 当前路由的名称，如果有的话。
   */
  name?: string;
  parent?: RouteRecord;
  redirect?: Router.RedirectOption;
  matchAs?: string;
  /**
   * 路由元信息
   */
  meta: Route.meta;
  /**
   * 路由前置守卫
   */
  beforeEnter?: Router.NavigationGuard;
  props: boolean | props | RoutePropsFunction | Dictionary<boolean | props | RoutePropsFunction>;
}
declare abstract class Router {
  constructor(options?: Router.Options);

  mode: Router.mode;
  currentRoute: Route;

  getLink: (router: Router, options: any) => any;
  getView: (router: Router, options: any) => any;
  
  beforeEach(guard: Router.NavigationGuard): Router.unHook ;
  beforeResolve(guard: Router.NavigationGuard): Router.unHook ;
  afterEach(hook: Router.AfterNavigationHook): Router.unHook;
  push(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void;
  replace(location: RawLocation, onComplete?: Router.CompleteHandler, onAbort?: Router.ErrorHandler): void;
  go(n: number): void;
  back(): void;
  forward(): void;
  getMatchedComponents(to?: RawLocation | Route): Component[];
  onReady(cb: Router.ReadyHandler, errorCb?: Router.ErrorHandler): void;
  onError(cb: Router.ErrorHandler): void;
  addRoutes(routes: Router.Config[]): void;
  resolve(to: RawLocation, current?: Route, append?: boolean): {
    location: EtsxLocation;
    route: Route;
    href: string;
    // backwards compat
    normalizedTo: EtsxLocation;
    resolved: Route;
  };
}


declare namespace Router {
  /**
   * "weex" (weex环境) | "history" (浏览器环境) | "abstract" (Node.js 环境)
   */
  export type mode = "hash" | "weex" | "history" | "abstract";
  
  export type ReadyHandler = (route?: Route) => void;
  export type ErrorHandler = (err: Error) => void;
  export type CompleteHandler = (route: Route) => void;

  /**
   * 位置 * 一般用于记录滚动条的位置
   */
  export type Position = { x: number, y: number };
  /**
   * 滚动条位置结果
   */
  export type PositionResult = Position | { selector: string, offset?: Position } | void;
  /**
   * 重定向配置选项
   */
  export type RedirectOption = RawLocation | ((to: Route) => RawLocation);

  interface PathToRegexpOptions {
    sensitive?: boolean;
    strict?: boolean;
    end?: boolean;
  }
  /**
   * 配置
   */
  export type Config<P extends object = PathToRegexpOptions> = {
    /**
     * 匹配路径
     */
    path: string;
    /**
     * 一个路由规则的名字
     */
    name?: string;
    /**
     * 默认视图组件
     */
    component?: Component;
    /**
     * 命名视图组件
     */
    components?: Dictionary<Component>;
    async: boolean | Dictionary<boolean>;
    redirect?: Router.RedirectOption;
    /**
     * 别名
     */
    alias?: string | string[];
    /**
     * 嵌套路由
     */
    children?: Config[];
    /**
     * 路由元信息
     */
    meta?: Route.meta;
    /**
     * 路由前置守卫
     */
    beforeEnter?: NavigationGuard;
    /**
     * 组件参数
     */
    props?: boolean | props | RoutePropsFunction;
    /**
     * 匹配规则是否大小写敏感？
     * 默认值：false
     */
    caseSensitive?: boolean;
    /**
     * 编译正则的选项
     */
    pathToRegexpOptions?: P;
  }

  export type Options = {
    /**
     * 路由配置
     */
    routes?: Config[];
    /**
     * 默认值: "weex" (weex环境) | "history" (浏览器环境) | "abstract" (Node.js 环境)
     * 可选值: "weex" | "history" | "abstract"
     */
    mode?: Router.mode;
    /**
     * 当浏览器不支持 history.pushState 控制路由是否应该回退到 hash 模式。默认值为 true。
     * 在 IE9 中，设置为 false 会使得每个 router-link 导航都触发整页刷新。
     * 它可用于工作在 IE9 下的服务端渲染应用，
     * 因为一个 hash 模式的 URL 并不支持服务端渲染。
     */
    fallback?: boolean;
    /**
     * 默认值: "/"
     * 应用的基路径。例如，如果整个单页应用服务在 /app/ 下，然后 base 就应该设为 "/app/"
     */
    base?: string;
    /**
     * 全局配置 <router-link> 的默认“激活 class 类名”。
     * 默认值: "router-link-active"
     */
    linkActiveClass?: string;
    /**
     * 全局配置 <router-link> 精确激活的默认的 class。
     * 默认值: "router-link-exact-active"
     */
    linkExactActiveClass?: string;
    /**
     * 提供自定义查询字符串的解析函数。覆盖默认行为。
     */
    parseQuery?: (query: string) => Route.query;
    /**
     * 提供自定义查询字符串的反解析函数。覆盖默认行为。
     */
    stringifyQuery?: (query: Route.query) => string;
    /**
     * 使用前端路由，当切换到新路由时，
     * 想要页面滚到顶部，或者是保持原先的滚动位置，
     * 就像重新加载页面那样。
     *
     * etsx-router 能做到，而且更好，
     * 它让你可以自定义路由切换时页面如何滚动。
     *
     * 注意: 这个功能只在支持 history.pushState 的浏览器中可用。
     *
     * 实现参考vue
     * @see https://router.vuejs.org/zh/guide/advanced/scroll-behavior.html
     */
    scrollBehavior?: (
      to: Route,
      from: Route,
      savedPosition: Position | void,
    ) => PositionResult | Promise<PositionResult>;
  }

  type R = RawLocation | false | void;
  export type NavigationGuard<E extends any = any> = (
    to: Route,
    from: Route,
    next: (to?: R | ((vm: E) => (R | Promise<R>))) => void,
  ) => any

  export type AfterNavigationHook = (to: Route, from: Route) => any;


  export type unHook = () => void
  export type listenCallback = (r: Route) => void;
}
