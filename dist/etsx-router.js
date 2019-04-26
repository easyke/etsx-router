/*!
  * etsx-router v0.0.1
  * (c) 2019 huadi
  * @license MIT
  */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.EtsxRouter = {})));
}(this, (function (exports) { 'use strict';

/**
 * Expose `pathToRegexp`.
 */
var pathToRegexp_1 = pathToRegexp;
var parse_1 = parse;
var compile_1 = compile;
var tokensToFunction_1 = tokensToFunction;
var tokensToRegExp_1 = tokensToRegExp;

/**
 * Default configs.
 */
var DEFAULT_DELIMITER = '/';

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // ":test(\\d+)?" => ["test", "\d+", undefined, "?"]
  // "(\\d+)"  => [undefined, undefined, "\d+", undefined]
  '(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?'
].join('|'), 'g');

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = [];
  var key = 0;
  var index = 0;
  var path = '';
  var defaultDelimiter = (options && options.delimiter) || DEFAULT_DELIMITER;
  var whitelist = (options && options.whitelist) || undefined;
  var pathEscaped = false;
  var res;

  while ((res = PATH_REGEXP.exec(str)) !== null) {
    var m = res[0];
    var escaped = res[1];
    var offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1];
      pathEscaped = true;
      continue
    }

    var prev = '';
    var name = res[2];
    var capture = res[3];
    var group = res[4];
    var modifier = res[5];

    if (!pathEscaped && path.length) {
      var k = path.length - 1;
      var c = path[k];
      var matches = whitelist ? whitelist.indexOf(c) > -1 : true;

      if (matches) {
        prev = c;
        path = path.slice(0, k);
      }
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
      pathEscaped = false;
    }

    var repeat = modifier === '+' || modifier === '*';
    var optional = modifier === '?' || modifier === '*';
    var pattern = capture || group;
    var delimiter = prev || defaultDelimiter;

    tokens.push({
      name: name || key++,
      prefix: prev,
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: pattern
        ? escapeGroup(pattern)
        : '[^' + escapeString(delimiter === defaultDelimiter ? delimiter : (delimiter + defaultDelimiter)) + ']+?'
    });
  }

  // Push any remaining characters.
  if (path || index < str.length) {
    tokens.push(path + str.substr(index));
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length);

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
    }
  }

  return function (data, options) {
    var path = '';
    var encode = (options && options.encode) || encodeURIComponent;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        path += token;
        continue
      }

      var value = data ? data[token.name] : undefined;
      var segment;

      if (Array.isArray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but got array')
        }

        if (value.length === 0) {
          if (token.optional) { continue }

          throw new TypeError('Expected "' + token.name + '" to not be empty')
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j], token);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        segment = encode(String(value), token);

        if (!matches[i].test(segment)) {
          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but got "' + segment + '"')
        }

        path += token.prefix + segment;
        continue
      }

      if (token.optional) { continue }

      throw new TypeError('Expected "' + token.name + '" to be ' + (token.repeat ? 'an array' : 'a string'))
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$/()])/g, '\\$1')
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options && options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {Array=}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  if (!keys) { return path }

  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g);

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      });
    }
  }

  return path
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = [];

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source);
  }

  return new RegExp('(?:' + parts.join('|') + ')', flags(options))
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}  tokens
 * @param  {Array=}  keys
 * @param  {Object=} options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  options = options || {};

  var strict = options.strict;
  var start = options.start !== false;
  var end = options.end !== false;
  var delimiter = options.delimiter || DEFAULT_DELIMITER;
  var endsWith = [].concat(options.endsWith || []).map(escapeString).concat('$').join('|');
  var route = start ? '^' : '';

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof token === 'string') {
      route += escapeString(token);
    } else {
      var capture = token.repeat
        ? '(?:' + token.pattern + ')(?:' + escapeString(token.delimiter) + '(?:' + token.pattern + '))*'
        : token.pattern;

      if (keys) { keys.push(token); }

      if (token.optional) {
        if (!token.prefix) {
          route += '(' + capture + ')?';
        } else {
          route += '(?:' + escapeString(token.prefix) + '(' + capture + '))?';
        }
      } else {
        route += escapeString(token.prefix) + '(' + capture + ')';
      }
    }
  }

  if (end) {
    if (!strict) { route += '(?:' + escapeString(delimiter) + ')?'; }

    route += endsWith === '$' ? '$' : '(?=' + endsWith + ')';
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === 'string'
      ? endToken[endToken.length - 1] === delimiter
      : endToken === undefined;

    if (!strict) { route += '(?:' + escapeString(delimiter) + '(?=' + endsWith + '))?'; }
    if (!isEndDelimited) { route += '(?=' + escapeString(delimiter) + '|' + endsWith + ')'; }
  }

  return new RegExp(route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {Array=}                keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys)
  }

  if (Array.isArray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), keys, options)
  }

  return stringToRegexp(/** @type {string} */ (path), keys, options)
}
pathToRegexp_1.parse = parse_1;
pathToRegexp_1.compile = compile_1;
pathToRegexp_1.tokensToFunction = tokensToFunction_1;
pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

function assert(condition, message) {
    if (!condition) {
        throw new Error(("[vue-router] " + message));
    }
}
function warn(condition, message) {
    if ("development" !== 'production' && !condition) {
        // tslint:disable-next-line:no-console no-unused-expression
        typeof console !== 'undefined' && console.warn(("[vue-router] " + message));
    }
}
function isError(err) {
    return Object.prototype.toString.call(err).indexOf('Error') > -1;
}

function normalizePath(path, parent, strict) {
    if (!strict)
        { path = path.replace(/\/$/, ''); }
    if (path[0] === '/')
        { return path; }
    if (parent == null)
        { return path; }
    return cleanPath(((parent.path) + "/" + path));
}
function resolvePath(relative, base, append) {
    var firstChar = relative.charAt(0);
    if (firstChar === '/') {
        return relative;
    }
    if (firstChar === '?' || firstChar === '#') {
        return base + relative;
    }
    var stack = base.split('/');
    // remove trailing segment if:
    // - not appending
    // - appending to trailing slash (last segment is empty)
    if (!append || !stack[stack.length - 1]) {
        stack.pop();
    }
    // resolve relative path
    relative.replace(/^\//, '').split('/').forEach(function (segment) {
        if (segment === '..') {
            stack.pop();
        }
        else if (segment !== '.') {
            stack.push(segment);
        }
    });
    // ensure leading slash
    if (stack[0] !== '') {
        stack.unshift('');
    }
    return stack.join('/');
}
function parsePath(path) {
    var hash = '';
    var query = '';
    var hashIndex = path.indexOf('#');
    if (hashIndex >= 0) {
        hash = path.slice(hashIndex);
        path = path.slice(0, hashIndex);
    }
    var queryIndex = path.indexOf('?');
    if (queryIndex >= 0) {
        query = path.slice(queryIndex + 1);
        path = path.slice(0, queryIndex);
    }
    return {
        path: path,
        query: query,
        hash: hash,
    };
}
function cleanPath(path) {
    return path.replace(/\/\//g, '/');
}

var encodeReserveRE = /[!'()*]/g;
var encodeReserveReplacer = function (c) { return '%' + c.charCodeAt(0).toString(16); };
var commaRE = /%2C/g;
// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
var encode = function (str) { return encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ','); };
var decode = decodeURIComponent;
function resolveQuery(query, extraQuery, _parseQuery) {
    if ( extraQuery === void 0 ) extraQuery = {};

    var parse = _parseQuery || parseQuery;
    var parsedQuery;
    try {
        parsedQuery = parse(query || '');
    }
    catch (e) {
        // tslint:disable-next-line:no-unused-expression
        "development" !== 'production' && warn(false, e.message);
        parsedQuery = {};
    }
    Object.keys(extraQuery).forEach(function (key) {
        parsedQuery[key] = extraQuery[key];
    });
    return parsedQuery;
}
function parseQuery(query) {
    var res = {};
    query = query.trim().replace(/^(\?|#|&)/, '');
    if (!query) {
        return res;
    }
    query.split('&').forEach(function (param) {
        var parts = param.replace(/\+/g, ' ').split('=');
        var key = decode(parts.shift() || '');
        var val = parts.length > 0
            ? decode(parts.join('='))
            : null;
        if (res[key] === undefined) {
            res[key] = val;
        }
        else if (Array.isArray(res[key])) {
            res[key].push(val);
        }
        else {
            res[key] = [res[key], val];
        }
    });
    return res;
}
function stringifyQuery(obj) {
    var res = obj ? Object.keys(obj).map(function (key) {
        var val = obj[key];
        if (val === undefined) {
            return '';
        }
        if (val === null) {
            return encode(key);
        }
        if (Array.isArray(val)) {
            var result = [];
            val.forEach(function (val2) {
                if (val2 === undefined) {
                    return;
                }
                if (val2 === null) {
                    result.push(encode(key));
                }
                else {
                    result.push(encode(key) + '=' + encode(val2));
                }
            });
            return result.join('&');
        }
        return encode(key) + '=' + encode(val);
    }).filter(function (x) { return x.length > 0; }).join('&') : null;
    return res ? ("?" + res) : '';
}

var trailingSlashRE = /\/?$/;
function createRoute(record, location, redirectedFrom, router) {
    var stringifyQuery$$1 = router && router.options.stringifyQuery;
    // 克隆参数
    var query = location.query || {};
    try {
        query = clone(query);
    }
    catch (e) { }
    // 创建路由对象
    var route = {
        name: location.name || (record && record.name),
        meta: (record && record.meta) || {},
        path: location.path || '/',
        hash: location.hash || '',
        query: query,
        params: location.params || {},
        fullPath: getFullPath(location, stringifyQuery$$1),
        matched: record ? formatMatch(record) : [],
    };
    if (redirectedFrom) {
        route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery$$1);
    }
    // 冻结，让路由对象不可修改
    return Object.freeze(route);
}
function clone(value) {
    if (Array.isArray(value)) {
        return value.map(clone);
    }
    else if (value && typeof value === 'object') {
        var res = {};
        Object.keys(value).forEach(function (key) {
            res[key] = clone(value[key]);
        });
        return res;
    }
    else {
        return value;
    }
}
// the starting route that represents the initial state
var START = createRoute(void 0, { path: '/' });
// 获得包含当前路由的所有嵌套路径片段的路由记录
// 包含从根路由到当前路由的匹配记录，从上至下
function formatMatch(record) {
    var res = [];
    while (record) {
        res.unshift(record);
        record = record.parent;
    }
    return res;
}
function getFullPath(ref, _stringifyQuery) {
    var path = ref.path;
    var query = ref.query; if ( query === void 0 ) query = {};
    var hash = ref.hash; if ( hash === void 0 ) hash = '';

    var stringify = _stringifyQuery || stringifyQuery;
    return (path || '/') + stringify(query) + hash;
}
/**
 * 判断两个路由是否为同一个路由
 */
function isSameRoute(a, b) {
    if (b === START) {
        return a === b;
    }
    else if (!b) {
        return false;
    }
    else if (a.path && b.path) {
        return (a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
            a.hash === b.hash &&
            isObjectEqual(a.query, b.query));
    }
    else if (a.name && b.name) {
        return (a.name === b.name &&
            a.hash === b.hash &&
            isObjectEqual(a.query, b.query) &&
            isObjectEqual(a.params, b.params));
    }
    else {
        return false;
    }
}
function isObjectEqual(a, b) {
    if ( a === void 0 ) a = {};
    if ( b === void 0 ) b = {};

    // handle null value #1566
    if (!a || !b)
        { return a === b; }
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    return aKeys.every(function (key) {
        var aVal = a[key];
        var bVal = b[key];
        // check nested equality
        if (typeof aVal === 'object' && typeof bVal === 'object') {
            return isObjectEqual(aVal, bVal);
        }
        return String(aVal) === String(bVal);
    });
}
function isIncludedRoute(current, target) {
    return (current.path.replace(trailingSlashRE, '/').indexOf(target.path.replace(trailingSlashRE, '/')) === 0 &&
        (!target.hash || current.hash === target.hash) &&
        queryIncludes(current.query, target.query));
}
function queryIncludes(current, target) {
    for (var key in target) {
        if (!(key in current)) {
            return false;
        }
    }
    return true;
}

// $flow-disable-line
var regexpCompileCache = Object.create(null);
function fillParams(path, params, routeMsg) {
    params = params || {};
    try {
        var filler = regexpCompileCache[path] ||
            (regexpCompileCache[path] = pathToRegexp_1.compile(path));
        // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
        if (params.pathMatch)
            { params[0] = params.pathMatch; }
        return filler(params, { pretty: true });
    }
    catch (e) {
        {
            warn(false, ("missing param for " + routeMsg + ": " + (e.message)));
        }
        return '';
    }
    finally {
        // delete the 0 if it was added
        delete params[0];
    }
}

function extend(a, b) {
    if (b) {
        Object.keys(b).forEach(function (key) {
            a[key] = b[key];
        });
    }
    return a;
}

function normalizeLocation(raw, current, append, router) {
    var next = typeof raw === 'string' ? { path: raw } : raw;
    // named target
    if (next._normalized) {
        return next;
    }
    else if (next.name) {
        return extend({}, raw);
    }
    // relative params
    if (!next.path && next.params && current) {
        next = extend({}, next);
        next._normalized = true;
        var params = extend(extend({}, current.params), next.params);
        if (current.name) {
            next.name = current.name;
            next.params = params;
        }
        else if (current.matched.length) {
            var rawPath = current.matched[current.matched.length - 1].path;
            next.path = fillParams(rawPath, params, ("path " + (current.path)));
        }
        else {
            warn(false, "relative params navigation requires a current route.");
        }
        return next;
    }
    var parsedPath = parsePath(next.path || '');
    var basePath = (current && current.path) || '/';
    var path = parsedPath.path
        ? resolvePath(parsedPath.path, basePath, append || next.append)
        : basePath;
    var query = resolveQuery(parsedPath.query, next.query, router && router.options.parseQuery);
    var hash = next.hash || parsedPath.hash;
    if (hash && hash.charAt(0) !== '#') {
        hash = "#" + hash;
    }
    return {
        _normalized: true,
        path: path,
        query: query,
        hash: hash,
    };
}

function createMatcher(routes, router) {
    return new Matcher(routes, router);
}
var Matcher = function Matcher(routes, router) {
    /**
     * 创建映射表
     */
    this.nameMap = Object.create(null);
    this.pathMap = Object.create(null);
    this.pathList = [];
    this.router = router;
    // 添加路由记录
    this.addRoutes(routes);
    this.match = this.match.bind(this);
    this.addRoutes = this.addRoutes.bind(this);
};
Matcher.prototype.addRoutes = function addRoutes (routes) {
        var this$1 = this;

    routes.forEach(function (route) { return this$1.addRouteRecord(route); });
    // 确保通配符路由始终在最后
    this.wildcardToEnd();
};
Matcher.prototype.match = function match (raw, currentRoute, redirectedFrom) {
    // 序列化 url
    // 比如对于该 url 来说 /abc?foo=bar&baz=qux#hello
    // 会序列化路径为 /abc
    // 哈希为 #hello
    // 参数为 foo: 'bar', baz: 'qux'
    var location = normalizeLocation(raw, currentRoute, false, this.router);
    var name = location.name;
    // 如果是命名路由，就判断记录中是否有该命名路由配置
    if (name) {
        var record = this.nameMap[name];
        {
            warn(record, ("Route with name '" + name + "' does not exist"));
        }
        // 没找到表示没有匹配的路由
        if (!record)
            { return this._createRoute(void 0, location); }
        var paramNames = record.keys
            .filter(function (key) { return !key.optional; })
            .map(function (key) { return key.name; });
        // 参数处理
        if (typeof location.params !== 'object') {
            location.params = {};
        }
        if (currentRoute && typeof currentRoute.params === 'object') {
            for (var key in currentRoute.params) {
                if (!(key in location.params) && paramNames.indexOf(key) > -1) {
                    location.params[key] = currentRoute.params[key];
                }
            }
        }
        if (record) {
            location.path = fillParams(record.path, location.params, ("named route \"" + name + "\""));
            return this._createRoute(record, location, redirectedFrom);
        }
    }
    else if (location.path) {
        // 非命名路由处理
        location.params = {};
        // tslint:disable-next-line:prefer-for-of
        for (var i = 0; i < this.pathList.length; i++) {
            // 查找记录
            var path = this.pathList[i];
            var record$1 = this.pathMap[path];
            // 如果匹配路由，则创建路由
            if (matchRoute(record$1, location.path, location.params)) {
                return this._createRoute(record$1, location, redirectedFrom);
            }
        }
    }
    // 没有匹配的路由 no match
    return this._createRoute(void 0, location);
};
/**
 * 根据条件创建不同的路由
 */
Matcher.prototype._createRoute = function _createRoute (record, location, redirectedFrom) {
    if (record && record.redirect) {
        return this.redirect(record, redirectedFrom || location);
    }
    if (record && record.matchAs) {
        return this.alias(record, location, record.matchAs);
    }
    return createRoute(record, location, redirectedFrom, this.router);
};
Matcher.prototype.redirect = function redirect (record, location) {
    var originalRedirect = record.redirect;
    var redirect = typeof originalRedirect === 'function'
        ? originalRedirect(createRoute(record, location, void 0, this.router))
        : originalRedirect;
    if (typeof redirect === 'string') {
        redirect = { path: redirect };
    }
    if (!redirect || typeof redirect !== 'object') {
        {
            warn(false, ("invalid redirect option: " + (JSON.stringify(redirect))));
        }
        return this._createRoute(void 0, location);
    }
    var re = redirect;
    var name = re.name;
        var path = re.path;
    var query = location.query;
        var hash = location.hash;
        var params = location.params;
    query = re.hasOwnProperty('query') ? re.query : query;
    hash = re.hasOwnProperty('hash') ? re.hash : hash;
    params = re.hasOwnProperty('params') ? re.params : params;
    if (name) {
        // resolved named direct
        var targetRecord = this.nameMap[name];
        {
            assert(targetRecord, ("redirect failed: named route \"" + name + "\" not found."));
        }
        return this.match({
            _normalized: true,
            name: name,
            query: query,
            hash: hash,
            params: params,
        }, undefined, location);
    }
    else if (path) {
        // 1. resolve relative redirect
        var rawPath = resolveRecordPath(path, record);
        // 2. resolve params
        var resolvedPath = fillParams(rawPath, params, ("redirect route with path \"" + rawPath + "\""));
        // 3. rematch with existing query and hash
        return this.match({
            _normalized: true,
            path: resolvedPath,
            query: query,
            hash: hash,
        }, undefined, location);
    }
    else {
        {
            warn(false, ("invalid redirect option: " + (JSON.stringify(redirect))));
        }
        return this._createRoute(void 0, location);
    }
};
Matcher.prototype.alias = function alias (record, location, matchAs) {
    var aliasedPath = fillParams(matchAs, location.params, ("aliased route with path \"" + matchAs + "\""));
    var aliasedMatch = this.match({
        _normalized: true,
        path: aliasedPath,
    });
    if (aliasedMatch) {
        var matched = aliasedMatch.matched;
        var aliasedRecord = matched[matched.length - 1];
        location.params = aliasedMatch.params;
        return this._createRoute(aliasedRecord, location);
    }
    return this._createRoute(void 0, location);
};
Matcher.prototype.addRouteRecord = function addRouteRecord (route, parent, matchAs) {
        var this$1 = this;

    // 获得路由配置下的属性
    var path = route.path;
        var name = route.name;
    {
        assert(path != null, "\"path\" is required in a route configuration.");
        assert(typeof route.component !== 'string', "route config \"component\" for path: " + (String(path || name)) + " cannot be a " +
            "string id. Use an actual component instead.");
    }
    var pathToRegexpOptions = route.pathToRegexpOptions || {};
    // 格式化 url，替换 "/",同时补充父层path
    var normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict);
    if (typeof route.caseSensitive === 'boolean') {
        // 如果为true，则regexp将区分大小写。（默认值：false）
        pathToRegexpOptions.sensitive = route.caseSensitive;
    }
    // 创建记录规则
    var ref = compileRouteRegex(normalizedPath, pathToRegexpOptions);
        var keys = ref.keys;
        var regex = ref.regex;
    var components;
    if (typeof route.components === 'object') {
        components = route.components;
    }
    else if (route.component && typeof route.component === 'function') {
        components = { default: route.component };
    }
    else if (typeof route.component === 'object') {
        components = route.component;
    }
    else {
        throw new Error('component or components must is class or object');
    }
    var async = {};
    Object.keys(components).forEach(function (key) {
        if (typeof route.async === 'boolean') {
            async[key] = route.async;
        }
        else if (typeof route.async === 'object') {
            async[key] = route.async[key] || false;
        }
        else {
            async[key] = false;
        }
    });
    // 生成记录对象
    var record = {
        path: normalizedPath,
        keys: keys,
        regex: regex,
        components: components,
        instances: {},
        name: name,
        parent: parent,
        matchAs: matchAs,
        redirect: route.redirect,
        beforeEnter: route.beforeEnter,
        meta: route.meta || {},
        props: route.props == null
            ? {}
            : route.components
                ? route.props
                : { default: route.props },
        async: async,
    };
    if (route.children) {
        // Warn if route is named, does not redirect and has a default child route.
        // If users navigate to this route by name, the default child will
        // not be rendered (GH Issue #629)
        {
            if (route.name && !route.redirect && route.children.some(function (child) { return /^\/?$/.test(child.path); })) {
                warn(false, "Named Route '" + (route.name) + "' has a default child route. " +
                    "When navigating to this named route (:to=\"{name: '" + (route.name) + "'\"), " +
                    "the default child route will not be rendered. Remove the name from " +
                    "this route and use the name of the default child route for named " +
                    "links instead.");
            }
        }
        // 递归路由配置的 children 属性，添加路由记录
        route.children.forEach(function (child) {
            var childMatchAs = matchAs ? cleanPath((matchAs + "/" + (child.path))) : void 0;
            this$1.addRouteRecord(child, record, childMatchAs);
        });
    }
    // 如果路由有别名的话
    // 给别名也添加路由记录
    if (route.alias !== undefined) {
        var aliases = Array.isArray(route.alias)
            ? route.alias
            : [route.alias];
        aliases.forEach(function (alias) {
            var aliasRoute = {
                path: alias,
                children: route.children,
                async: route.async,
            };
            this$1.addRouteRecord(aliasRoute, parent, record.path || '/');
        });
    }
    // 更新映射表
    if (!this.pathMap[record.path]) {
        this.pathList.push(record.path);
        this.pathMap[record.path] = record;
    }
    // 命名路由添加记录
    if (name) {
        if (!this.nameMap[name]) {
            this.nameMap[name] = record;
        }
        else if ("development" !== 'production' && !matchAs) {
            warn(false, "Duplicate named routes definition: " +
                "{ name: \"" + name + "\", path: \"" + (record.path) + "\" }");
        }
    }
};
/**
 * 把通配符路由移到最后
 */
Matcher.prototype.wildcardToEnd = function wildcardToEnd () {
    for (var i = 0, l = this.pathList.length; i < l; i++) {
        if (this.pathList[i] === '*') {
            // 切出来，然后插入最后
            this.pathList.push(this.pathList.splice(i, 1)[0]);
            l--;
            i--;
        }
    }
};
function matchRoute(record, path, params) {
    var m = path.match(record.regex);
    if (!m) {
        return false;
    }
    else if (!params) {
        return true;
    }
    for (var i = 1, len = m.length; i < len; ++i) {
        var key = record.keys[i - 1];
        var val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i];
        if (key) {
            // Fix #1994: using * with props: true generates a param named 0
            params[key.name || 'pathMatch'] = val;
        }
    }
    return true;
}
function resolveRecordPath(path, record) {
    return resolvePath(path, record.parent ? record.parent.path : '/', true);
}
function compileRouteRegex(path, pathToRegexpOptions) {
    // console.log('pathToRegexpOptions', pathToRegexpOptions, path === '', 555)
    var keys = [];
    var regex = pathToRegexp_1(path, keys, pathToRegexpOptions);
    // console.log('regex', regex)
    {
        var check = Object.create(null);
        keys.forEach(function (key) {
            warn(!check[key.name], ("Duplicate param keys in route with path: \"" + path + "\""));
            check[key.name] = true;
        });
    }
    return { keys: keys, regex: regex };
}

var inBrowser = typeof window !== 'undefined';

var positionStore = Object.create(null);
function setupScroll() {
    // Fix for #1585 for Firefox
    // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
    window.history.replaceState({ key: getStateKey() }, '', window.location.href.replace(window.location.origin, ''));
    window.addEventListener('popstate', function (e) {
        saveScrollPosition();
        if (e.state && e.state.key) {
            setStateKey(e.state.key);
        }
    });
}
function handleScroll(router, to, from, isPop) {
    if (!router.app) {
        return;
    }
    var behavior = router.options.scrollBehavior;
    if (!behavior) {
        return;
    }
    {
        assert(typeof behavior === 'function', "scrollBehavior must be a function");
    }
    // wait until re-render finishes before scrolling
    router.app.$nextTick(function () {
        var position = getScrollPosition();
        var shouldScroll = behavior.call(router, to, from, isPop ? position : void 0);
        if (!shouldScroll) {
            return;
        }
        if (typeof shouldScroll.then === 'function') {
            shouldScroll.then(function (shouldScroll) {
                scrollToPosition(shouldScroll, position);
            }).catch(function (err) {
                {
                    assert(false, err.toString());
                }
            });
        }
        else {
            scrollToPosition(shouldScroll, position);
        }
    });
}
function saveScrollPosition() {
    var key = getStateKey();
    if (key) {
        positionStore[key] = {
            x: window.pageXOffset,
            y: window.pageYOffset,
        };
    }
}
function getScrollPosition() {
    var key = getStateKey();
    if (key) {
        return positionStore[key];
    }
}
function getElementPosition(el, offset) {
    var docEl = document.documentElement;
    var docRect = docEl.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    return {
        x: elRect.left - docRect.left - offset.x,
        y: elRect.top - docRect.top - offset.y,
    };
}
function isValidPosition(obj) {
    return isNumber(obj.x) || isNumber(obj.y);
}
function normalizePosition(obj) {
    return {
        x: isNumber(obj.x) ? obj.x : window.pageXOffset,
        y: isNumber(obj.y) ? obj.y : window.pageYOffset,
    };
}
function normalizeOffset(obj) {
    return {
        x: isNumber(obj.x) ? obj.x : 0,
        y: isNumber(obj.y) ? obj.y : 0,
    };
}
function isNumber(v) {
    return typeof v === 'number';
}
function scrollToPosition(shouldScroll, position) {
    var isObject = typeof shouldScroll === 'object';
    if (isObject && typeof shouldScroll.selector === 'string') {
        var el = document.querySelector(shouldScroll.selector);
        if (el) {
            var offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {};
            offset = normalizeOffset(offset);
            position = getElementPosition(el, offset);
        }
        else if (isValidPosition(shouldScroll)) {
            position = normalizePosition(shouldScroll);
        }
    }
    else if (isObject && isValidPosition(shouldScroll)) {
        position = normalizePosition(shouldScroll);
    }
    if (position) {
        window.scrollTo(position.x, position.y);
    }
}

var supportsPushState = inBrowser && (function () {
    var ua = window.navigator.userAgent;
    if ((ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
        ua.indexOf('Mobile Safari') !== -1 &&
        ua.indexOf('Chrome') === -1 &&
        ua.indexOf('Windows Phone') === -1) {
        return false;
    }
    return window.history && 'pushState' in window.history;
})();
// use User Timing api (if present) for more accurate key precision
var Time = inBrowser && window.performance && window.performance.now
    ? window.performance
    : Date;
var _key = genKey();
function genKey() {
    return Time.now().toFixed(3);
}
function getStateKey() {
    return _key;
}
function setStateKey(key) {
    _key = key;
}
function pushState(url, replace) {
    saveScrollPosition();
    // try...catch the pushState call to get around Safari
    // DOM Exception 18 where it limits to 100 pushState calls
    var history = window.history;
    try {
        if (replace) {
            history.replaceState({ key: _key }, '', url);
        }
        else {
            _key = genKey();
            history.pushState({ key: _key }, '', url);
        }
    }
    catch (e) {
        window.location[replace ? 'replace' : 'assign'](url || '');
    }
}
function replaceState(url) {
    pushState(url, true);
}

function objectWithoutProperties (obj, exclude) { var target = {}; for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && exclude.indexOf(k) === -1) target[k] = obj[k]; return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) { return {}; } var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) { continue; } target[key] = source[key]; } return target; }

function getLink (router, ref) {
    var Component = ref.Component;
    var createElement = ref.createElement;
    var cloneElement = ref.cloneElement;
    var PropTypes = ref.PropTypes;

  
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
    });
    return RouterLink;
}

function guardEvent(e) {
  // 忽略带有功能键的点击，不要使用控制键重定向
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }
  // 已阻止的返回，当preventDefault调用时，不要重定向
  if (e.defaultPrevented) { return }
  // 阻止右键单击
  if (e.button !== undefined && e.button !== 0) { return }
  // 如果`target ="_blank"`，忽略
  if (e.currentTarget && e.currentTarget.getAttribute) {
    var target = e.currentTarget.getAttribute('target');
    if (/\b_blank\b/i.test(target)) { return }
  }
  // 可能是一个Weex,没有这种方法
  if (e.preventDefault) {
    // 阻止默认行为 防止跳转
    e.preventDefault();
  }
  return true
}

function findAnchor(children, cloneElement, findCall, isFinded) {
  if ( isFinded === void 0 ) isFinded = false;

  if (!isFinded && children) {
    if (Array.isArray(children)) {
      children = children.map(function (c) {
        var res = findAnchor(c, cloneElement, findCall, isFinded);
        isFinded = res.isFinded;
        return res.children
      });
    } else if (children.type === 'a') {
      children = findCall(children);
      isFinded = true;
    } else if (children.props && children.props.children) {
      var ref = children.props;
      var childrenx = ref.children;
      var rest = objectWithoutProperties( ref, ["children"] );
      var props = rest;
      var res = findAnchor(childrenx, cloneElement, findCall, isFinded);
      if (cloneElement) {
        children = cloneElement(children, props, res.children);
      } else {
        children.children = res.children;
      }
      isFinded = res.isFinded;
    }
  }
  return {isFinded: isFinded, children: children}
}

function getView (router, ref) {
  var Component = ref.Component;
  var createElement = ref.createElement;
  var PropTypes = ref.PropTypes;

  function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) { return {}; } var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) { continue; } target[key] = source[key]; } return target; }


function RouterView() {
  var arguments$1 = arguments;

  var _this;

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments$1[_key];
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
});
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
      {
        warn(
          false,
          "props in \"" + (route.path) + "\" is a " + (typeof config) + ", " +
          "expecting an object, function or boolean."
        );
      }
  }
}

var runQueue = function (queue, fn, cb) {
    var step = function (index) {
        if (index >= queue.length) {
            cb();
        }
        else {
            if (queue[index]) {
                fn(queue[index], function () {
                    step(index + 1);
                });
            }
            else {
                step(index + 1);
            }
        }
    };
    step(0);
};

/**
 * 解析异步路由组件
 * @param matched 已经匹配的路由记录
 */
function resolveAsyncComponents(matched) {
    return function (to, from, next) {
        var hasAsync = false;
        var pending = 0;
        var error = null;
        flatMapComponents(matched, function (def, _, match, key) {
            // if it's a function and doesn't have cid attached,
            // assume it's an async component resolve function.
            // we are not using Vue's default async resolving mechanism because
            // we want to halt the navigation until the incoming component has been
            // resolved.
            if (typeof def === 'function' && match.async[key] === true) {
                hasAsync = true;
                pending++;
                var resolve = once(function (resolvedDef) {
                    if (isESModule(resolvedDef)) {
                        resolvedDef = resolvedDef.default;
                    }
                    // save resolved on async factory in case it's used elsewhere
                    match.async[key] = false;
                    match.components[key] = resolvedDef;
                    pending--;
                    if (pending <= 0) {
                        next();
                    }
                });
                var reject = once(function (reason) {
                    var msg = "Failed to resolve async component " + key + ": " + reason;
                    {
                        warn(false, msg);
                    }
                    if (!error) {
                        error = isError(reason)
                            ? reason
                            : new Error(msg);
                        next(error);
                    }
                });
                var res;
                try {
                    res = def(resolve, reject);
                }
                catch (e) {
                    reject(e);
                }
                if (res) {
                    if (typeof res.then === 'function') {
                        res.then(resolve, reject);
                    }
                    else {
                        // new syntax in Vue 2.3
                        var comp = res.component;
                        if (comp && typeof comp.then === 'function') {
                            comp.then(resolve, reject);
                        }
                    }
                }
            }
        });
        if (!hasAsync)
            { next(); }
    };
}
function flatMapComponents(matched, fn) {
    // 数组降维
    return flatten(matched.map(function (m) {
        // 将组件中的对象传入回调函数中，获得钩子函数数组
        return Object.keys(m.components).map(function (key) { return fn(m.components[key], m.instances[key], m, key); });
    }));
}
/**
 * 数组降维 - 转为平行
 */
function flatten(arr) {
    return Array.prototype.concat.apply([], arr);
}
var hasSymbol = typeof Symbol === 'function' &&
    typeof Symbol.toStringTag === 'symbol';
function isESModule(obj) {
    return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module');
}
function once(fn) {
    var called = false;
    return function () {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        if (called)
            { return; }
        called = true;
        return fn.apply(this, args);
    };
}

var History = function History(router, base) {
    this.router = router;
    this.base = normalizeBase(base);
    // start with a route object that stands for "nowhere"
    this.router.currentRoute = START;
    this.pending = void 0;
    this.ready = false;
    this.readyCbs = [];
    this.readyErrorCbs = [];
    this.errorCbs = [];
    this.cb = function () { return void 0; };
};
History.prototype.init = function init () { };
History.prototype.listen = function listen (cb) {
    this.cb = cb;
};
History.prototype.onReady = function onReady (cb, errorCb) {
    if (this.ready) {
        cb();
    }
    else {
        this.readyCbs.push(cb);
        if (errorCb) {
            this.readyErrorCbs.push(errorCb);
        }
    }
};
History.prototype.onError = function onError (errorCb) {
    this.errorCbs.push(errorCb);
};
/**
 * 路由跳转
 * @param location 地址
 * @param onComplete 完成时
 * @param onAbort 取消
 */
History.prototype.transitionTo = function transitionTo (location, onComplete, onAbort) {
        var this$1 = this;

    // 获取匹配的路由信息
    var route = this.router.match(location, this.router.currentRoute);
    // 确认切换路由
    this.confirmTransition(route, function () {
        /**
         * 以下为切换路由成功或失败的回调
         * 更新路由信息，对组件的 _route 属性进行赋值，触发组件渲染
         * 调用 afterHooks 中的钩子函数
         */
        this$1.updateRoute(route);
        if (typeof onComplete === 'function') {
            // 如果有完成，就触发完成回调
            onComplete(route);
        }
        // 更新 URL
        this$1.ensureURL();
        /**
         * 只执行一次 ready 回调
         * fire ready cbs once
         */
        if (!this$1.ready) {
            this$1.ready = true;
            this$1.readyCbs.forEach(function (cb) { cb(route); });
        }
    }, function (err) {
        // 错误处理
        if (onAbort) {
            onAbort(err);
        }
        if (err && !this$1.ready) {
            this$1.ready = true;
            this$1.readyErrorCbs.forEach(function (cb) { cb(err); });
        }
    });
};
/**
 * 确认切换路由
 * @param route
 * @param onComplete
 * @param onAbort
 */
History.prototype.confirmTransition = function confirmTransition (route, onComplete, onAbort) {
        var this$1 = this;

    var current = this.router.currentRoute;
    // 定义中断跳转路由函数
    var abort = function (err) {
        if (err && isError(err)) {
            if (this$1.errorCbs.length) {
                this$1.errorCbs.forEach(function (cb) { cb(err); });
            }
            else {
                warn(false, 'uncaught error during route navigation:');
                if (console) {
                    // tslint:disable-next-line:no-console
                    console.error(err);
                }
            }
        }
        if (typeof onAbort === 'function') {
            onAbort(err);
        }
    };
    // 如果是相同的路由就不跳转
    if (isSameRoute(route, current) &&
        // in the case the route map has been dynamically appended to
        route.matched.length === current.matched.length) {
        this.ensureURL();
        return abort();
    }
    // 通过对比路由解析出可复用的组件，需要渲染的组件，失活的组件
    var ref = resolveQueue(this.router.currentRoute.matched, route.matched);
        var updated = ref.updated;
        var deactivated = ref.deactivated;
        var activated = ref.activated;
    // 导航守卫数组
    var queue = [].concat(
    // 失活的组件钩子 [in-component leave guards]
    extractLeaveGuards(deactivated), 
    // 全局 beforeEach 钩子
    this.router.beforeHooks, 
    // 在当前路由改变，但是该组件被复用时调用[in-component update hooks]
    extractUpdateHooks(updated), 
    // 需要渲染组件 enter 守卫钩子[in-config enter guards]
    activated.map(function (m) { return m.beforeEnter; }), 
    // 解析异步路由组件[async components] - react 不建议支持Promise
    resolveAsyncComponents(activated));
    // 保存路由
    this.pending = route;
    // 迭代器，用于执行 queue 中的导航守卫钩子
    var iterator = function (hook, next) {
        // 路由不相等就不跳转路由
        if (this$1.pending !== route) {
            return abort();
        }
        try {
            // 试图执行钩子
            hook(route, current, function (to) {
                /**
                 * 只有执行了钩子函数中的 next，
                 * 才会继续执行下一个钩子函数
                 * 否则会暂停跳转
                 * 以下逻辑是在判断 next() 中的传参
                 */
                if (to === false || isError(to)) {
                    // next(false) -> abort navigation, ensure current URL
                    this$1.ensureURL(true);
                    abort(to);
                }
                else if (typeof to === 'string' ||
                    (typeof to === 'object' && (typeof to.path === 'string' ||
                        typeof to.name === 'string'))) {
                    // next('/') or next({ path: '/' }) -> redirect
                    // next('/') 或者 next({ path: '/' }) -> 重定向
                    abort();
                    if (typeof to === 'object' && to.replace) {
                        this$1.replace(to);
                    }
                    else {
                        this$1.push(to);
                    }
                }
                else {
                    // confirm transition and pass on the value
                    // 也就是执行下面函数 runQueue 中的 step(index + 1)
                    next(to);
                }
            });
        }
        catch (e) {
            abort(e);
        }
    };
    // 经典的同步执行异步函数
    runQueue(queue, iterator, function () {
        var postEnterCbs = [];
        var isValid = function () { return this$1.router.currentRoute === route; };
        // 当所有异步组件加载完成后，会执行这里的回调，也就是 runQueue 中的 cb()
        // 接下来执行 需要渲染组件的导航守卫钩子
        // wait until async components are resolved before
        // extracting in-component enter guards
        var enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
        var queue = enterGuards.concat(this$1.router.resolveHooks);
        runQueue(queue, iterator, function () {
            // 跳转完成
            if (this$1.pending !== route) {
                return abort();
            }
            this$1.pending = void 0;
            onComplete(route);
            if (this$1.router.app) {
                this$1.router.app.$nextTick(function () {
                    postEnterCbs.forEach(function (cb) { cb(); });
                });
            }
        });
    });
};
History.prototype.updateRoute = function updateRoute (route) {
    var prev = this.router.currentRoute;
    this.router.currentRoute = route;
    if (this.cb) {
        this.cb(route);
    }
    this.router.afterHooks.forEach(function (hook) { return hook && hook(route, prev); });
};
function normalizeBase(base) {
    if (!base) {
        if (inBrowser) {
            // respect <base> tag
            var baseEl = document.querySelector('base');
            base = (baseEl && baseEl.getAttribute('href')) || '/';
            // strip full URL origin
            base = base.replace(/^https?:\/\/[^\/]+/, '');
        }
        else {
            base = '/';
        }
    }
    // make sure there's the starting slash
    if (base.charAt(0) !== '/') {
        base = '/' + base;
    }
    // remove trailing slash
    return base.replace(/\/$/, '');
}
function resolveQueue(current, next) {
    var i;
    var max = Math.max(current.length, next.length);
    for (i = 0; i < max; i++) {
        // 当前路由路径和跳转路由路径不同时跳出遍历
        if (current[i] !== next[i]) {
            break;
        }
    }
    return {
        // 可复用的组件对应路由
        updated: next.slice(0, i),
        // 需要渲染的组件对应路由
        activated: next.slice(i),
        // 失活的组件对应路由
        deactivated: current.slice(i),
    };
}
function extractGuards(records, name, bind, reverse) {
    var guards = flatMapComponents(records, function (def, instance, match, key) {
        var guard = def.prototype && def.prototype[name];
        if (guard) {
            return bind(guard, instance, match, key);
        }
    });
    /**
     * 数组降维，并且判断是否需要翻转数组
     * 因为某些钩子函数需要从子执行到父
     */
    return flatten(reverse ? guards.reverse() : guards);
}
/**
 * 执行失活组件的钩子函数
 * 也就是销毁前的回调
 * 导航离开该组件的对应路由时调用
 * 可以访问组件实例 `this`
 */
function extractLeaveGuards(deactivated) {
    return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true);
}
/**
 * 使用了同一个组件[类]，可以复用实例，
 * 直接调用钩子来刷新数据
 * --
 * 在当前路由改变，但是该组件被复用时调用
 * 举例来说，对于一个带有动态参数的路径 /foo/:id，在 /foo/1 和 /foo/2 之间跳转的时候，
 * 由于会渲染同样的 Foo 组件，因此组件实例会被复用。而这个钩子就会在这个情况下被调用。
 * 可以访问组件实例 `this`
 */
function extractUpdateHooks(updated) {
    return extractGuards(updated, 'beforeRouteUpdate', bindGuard);
}
/**
 * 把钩子的`this`上下文绑定到要执行的`Component`实例中
 * @param guard 守卫钩子
 * @param instance 需要绑定是组件实例
 */
function bindGuard(guard, instance) {
    if (instance) {
        return guard.bind(instance);
    }
}
/**
 * 在渲染该组件的对应路由被 confirm 前调用
 * 不！能！获取组件实例 `this`
 * 因为当守卫执行前，组件实例还没被创建
 *
 * @param activated
 * @param cbs
 * @param isValid
 */
function extractEnterGuards(activated, cbs, isValid) {
    return extractGuards(activated, 'beforeRouteEnter', function (guard, _, match, key) {
        return bindEnterGuard(guard, match, key, cbs, isValid);
    });
}
function bindEnterGuard(guard, match, key, cbs, isValid) {
    return function routeEnterGuard(to, from, next) {
        return guard(to, from, function (cb) {
            next(cb);
            if (typeof cb === 'function') {
                cbs.push(function () {
                    // #750
                    // if a router-view is wrapped with an out-in transition,
                    // the instance may not have been registered at this time.
                    // we will need to poll for registration until current route
                    // is no longer valid.
                    poll(cb, match.instances, key, isValid);
                });
            }
        });
    };
}
function poll(cb, // somehow flow cannot infer this is a function
instances, key, isValid) {
    if (instances[key] &&
        !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
    ) {
        cb(instances[key]);
    }
    else if (isValid()) {
        setTimeout(function () {
            poll(cb, instances, key, isValid);
        }, 16);
    }
}

/* @flow */
var HTML5History = /*@__PURE__*/(function (History$$1) {
    function HTML5History(router, base) {
        var this$1 = this;

        History$$1.call(this, router, base);
        var expectScroll = router.options.scrollBehavior;
        var supportsScroll = supportsPushState && expectScroll;
        if (supportsScroll) {
            setupScroll();
        }
        var initLocation = getLocation(this.base);
        window.addEventListener('popstate', function (e) {
            var current = this$1.router.currentRoute;
            // Avoiding first `popstate` event dispatched in some browsers but first
            // history route not updated since async guard at the same time.
            var location = getLocation(this$1.base);
            if (this$1.router.currentRoute === START && location === initLocation) {
                return;
            }
            this$1.transitionTo(location, function (route) {
                if (supportsScroll) {
                    handleScroll(router, route, current, true);
                }
            });
        });
    }

    if ( History$$1 ) HTML5History.__proto__ = History$$1;
    HTML5History.prototype = Object.create( History$$1 && History$$1.prototype );
    HTML5History.prototype.constructor = HTML5History;
    HTML5History.prototype.init = function init () {
        this.transitionTo(this.getCurrentLocation());
    };
    HTML5History.prototype.go = function go (n) {
        window.history.go(n);
    };
    HTML5History.prototype.push = function push (location, onComplete, onAbort) {
        var this$1 = this;

        var fromRoute = this.router.currentRoute;
        this.transitionTo(location, function (route) {
            pushState(cleanPath(this$1.base + route.fullPath));
            handleScroll(this$1.router, route, fromRoute, false);
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    HTML5History.prototype.replace = function replace (location, onComplete, onAbort) {
        var this$1 = this;

        var fromRoute = this.router.currentRoute;
        this.transitionTo(location, function (route) {
            replaceState(cleanPath(this$1.base + route.fullPath));
            handleScroll(this$1.router, route, fromRoute, false);
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    HTML5History.prototype.ensureURL = function ensureURL (push) {
        if (getLocation(this.base) !== this.router.currentRoute.fullPath) {
            var current = cleanPath(this.base + this.router.currentRoute.fullPath);
            push ? pushState(current) : replaceState(current);
        }
    };
    HTML5History.prototype.getCurrentLocation = function getCurrentLocation () {
        return getLocation(this.base);
    };

    return HTML5History;
}(History));
function getLocation(base) {
    var path = decodeURI(window.location.pathname);
    if (base && path.indexOf(base) === 0) {
        path = path.slice(base.length);
    }
    return (path || '/') + window.location.search + window.location.hash;
}

/* @flow */
var HashHistory = /*@__PURE__*/(function (History$$1) {
    function HashHistory(router, base, fallback) {
        if ( fallback === void 0 ) fallback = false;

        History$$1.call(this, router, base);
        // check history fallback deeplinking
        if (fallback && checkFallback(this.base)) {
            return;
        }
        ensureSlash();
    }

    if ( History$$1 ) HashHistory.__proto__ = History$$1;
    HashHistory.prototype = Object.create( History$$1 && History$$1.prototype );
    HashHistory.prototype.constructor = HashHistory;
    HashHistory.prototype.init = function init () {
        var this$1 = this;

        var setupHashListener = function () {
            this$1.setupListeners();
        };
        this.transitionTo(this.getCurrentLocation(), setupHashListener, setupHashListener);
    };
    // this is delayed until the app mounts
    // to avoid the hashchange listener being fired too early
    HashHistory.prototype.setupListeners = function setupListeners () {
        var this$1 = this;

        var router = this.router;
        var expectScroll = router.options.scrollBehavior;
        var supportsScroll = supportsPushState && expectScroll;
        if (supportsScroll) {
            setupScroll();
        }
        window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', function () {
            var current = this$1.router.currentRoute;
            if (!ensureSlash()) {
                return;
            }
            this$1.transitionTo(getHash(), function (route) {
                if (supportsScroll) {
                    handleScroll(this$1.router, route, current, true);
                }
                if (!supportsPushState) {
                    replaceHash(route.fullPath);
                }
            });
        });
    };
    HashHistory.prototype.push = function push (location, onComplete, onAbort) {
        var this$1 = this;

        var fromRoute = this.router.currentRoute;
        this.transitionTo(location, function (route) {
            pushHash(route.fullPath);
            handleScroll(this$1.router, route, fromRoute, false);
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    HashHistory.prototype.replace = function replace (location, onComplete, onAbort) {
        var this$1 = this;

        var fromRoute = this.router.currentRoute;
        this.transitionTo(location, function (route) {
            replaceHash(route.fullPath);
            handleScroll(this$1.router, route, fromRoute, false);
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    HashHistory.prototype.go = function go (n) {
        window.history.go(n);
    };
    HashHistory.prototype.ensureURL = function ensureURL (push) {
        var current = this.router.currentRoute.fullPath;
        if (getHash() !== current) {
            push ? pushHash(current) : replaceHash(current);
        }
    };
    HashHistory.prototype.getCurrentLocation = function getCurrentLocation () {
        return getHash();
    };

    return HashHistory;
}(History));
function checkFallback(base) {
    var location = getLocation(base);
    if (!/^\/#/.test(location)) {
        window.location.replace(cleanPath(base + '/#' + location));
        return true;
    }
}
function ensureSlash() {
    var path = getHash();
    if (path.charAt(0) === '/') {
        return true;
    }
    replaceHash('/' + path);
    return false;
}
function getHash() {
    // We can't use window.location.hash here because it's not
    // consistent across browsers - Firefox will pre-decode it!
    var href = window.location.href;
    var index = href.indexOf('#');
    return index === -1 ? '' : decodeURI(href.slice(index + 1));
}
function getUrl(path) {
    var href = window.location.href;
    var i = href.indexOf('#');
    var base = i >= 0 ? href.slice(0, i) : href;
    return (base + "#" + path);
}
function pushHash(path) {
    if (supportsPushState) {
        pushState(getUrl(path));
    }
    else {
        window.location.hash = path;
    }
}
function replaceHash(path) {
    if (supportsPushState) {
        replaceState(getUrl(path));
    }
    else {
        window.location.replace(getUrl(path));
    }
}

var AbstractHistory = /*@__PURE__*/(function (History$$1) {
    function AbstractHistory(router, base) {
        History$$1.call(this, router, base);
        this.stack = [];
        this.index = -1;
    }

    if ( History$$1 ) AbstractHistory.__proto__ = History$$1;
    AbstractHistory.prototype = Object.create( History$$1 && History$$1.prototype );
    AbstractHistory.prototype.constructor = AbstractHistory;
    AbstractHistory.prototype.push = function push (location, onComplete, onAbort) {
        var this$1 = this;

        this.transitionTo(location, function (route) {
            this$1.stack = this$1.stack.slice(0, this$1.index + 1).concat(route);
            this$1.index++;
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    AbstractHistory.prototype.replace = function replace (location, onComplete, onAbort) {
        var this$1 = this;

        this.transitionTo(location, function (route) {
            this$1.stack = this$1.stack.slice(0, this$1.index).concat(route);
            if (typeof onComplete === 'function') {
                onComplete(route);
            }
        }, onAbort);
    };
    AbstractHistory.prototype.go = function go (n) {
        var this$1 = this;

        var targetIndex = this.index + n;
        if (targetIndex < 0 || targetIndex >= this.stack.length) {
            return;
        }
        var route = this.stack[targetIndex];
        this.confirmTransition(route, function () {
            this$1.index = targetIndex;
            this$1.updateRoute(route);
        });
    };
    AbstractHistory.prototype.getCurrentLocation = function getCurrentLocation () {
        var current = this.stack[this.stack.length - 1];
        return current ? current.fullPath : '/';
    };
    AbstractHistory.prototype.ensureURL = function ensureURL () {
        // noop
    };

    return AbstractHistory;
}(History));

var isWeex = false;
var Router = function Router(options) {
    var this$1 = this;

    this.options = options || {};
    this.beforeHooks = [];
    this.resolveHooks = [];
    this.afterHooks = [];
    this.currentRoute = START;
    /**
     * 如果提供了一个匹配方法进来，就直接使用，否则就创建路由映射表
     */
    if (typeof this.options.match === 'function') {
        this.match = this.options.match;
    }
    else if (this.options.routes !== false) {
        this.matcher = createMatcher(this.options.routes || [], this);
    }
    this.getLink = function (options) { return getLink(this$1, options); };
    this.getView = function (options) { return getView(this$1, options); };
    this.fallback = this.options.mode === 'history' && !supportsPushState && this.options.fallback !== false;
    var mode;
    if (this.options.mode) {
        mode = this.options.mode;
    }
    else if (inBrowser) {
        mode = this.options.mode || 'history';
        if (this.fallback) {
            mode = 'hash';
        }
    }
    if (isWeex) {
        mode = 'weex';
    }
    else if (!inBrowser) {
        mode = 'abstract';
    }
    this.mode = mode || 'abstract';
    switch (this.mode) {
        // case 'weex':
        //   this.history = new WeexHistory(this, this.options.base)
        //   break
        case 'history':
            this.history = new HTML5History(this, this.options.base);
            break;
        case 'hash':
            this.history = new HashHistory(this, this.options.base, this.fallback);
            break;
        case 'abstract':
            this.history = new AbstractHistory(this, this.options.base);
            break;
        default:
            this.history = new AbstractHistory(this, this.options.base);
            {
                assert(false, ("invalid mode: " + (this.mode)));
            }
    }
};
Router.prototype.withRouter = function withRouter () {
};
Router.prototype.init = function init () {
    if (typeof this.history.init === 'function') {
        this.history.init();
    }
};
Router.prototype.beforeEach = function beforeEach (guard) {
    return registerHook(this.beforeHooks, guard);
};
Router.prototype.beforeResolve = function beforeResolve (guard) {
    return registerHook(this.resolveHooks, guard);
};
Router.prototype.afterEach = function afterEach (hook) {
    return registerHook(this.afterHooks, hook);
};
Router.prototype.onReady = function onReady (cb, errorCb) {
    this.history.onReady(cb, errorCb);
};
Router.prototype.onError = function onError (errorCb) {
    this.history.onError(errorCb);
};
Router.prototype.push = function push (location, onComplete, onAbort) {
    this.history.push(location, onComplete, onAbort);
};
Router.prototype.replace = function replace (location, onComplete, onAbort) {
    this.history.replace(location, onComplete, onAbort);
};
/**
 * 去到
 * @param n 去到第几栈
 */
Router.prototype.go = function go (n) {
    this.history.go(n);
};
/**
 * 后退
 */
Router.prototype.back = function back () {
    this.go(-1);
};
/**
 * 向前
 */
Router.prototype.forward = function forward () {
    this.go(1);
};
Router.prototype.getMatchedComponents = function getMatchedComponents (to) {
    var route = to ? to.matched ? to : this.resolve(to).route
        : this.currentRoute;
    if (!route) {
        return [];
    }
    return [].concat.apply([], route.matched.map(function (m) { return Object.keys(m.components).map(function (key) { return m.components[key]; }); }));
};
Router.prototype.resolve = function resolve (to, current, append) {
    current = current || this.currentRoute;
    var location = normalizeLocation(to, current, append, this);
    var route = this.match(location, current);
    var fullPath = route.redirectedFrom || route.fullPath;
    var base = this.history.base;
    var href = createHref(base, fullPath, this.mode);
    return {
        location: location,
        route: route,
        href: href,
        // for backwards compat
        normalizedTo: location,
        resolved: route,
    };
};
/**
 * 路由匹配
 * @param raw 原始路径
 * @param current 当前路由
 * @param redirectedFrom 来源路由
 */
Router.prototype.match = function match (raw, current, redirectedFrom) {
    if (!this.matcher) {
        throw new Error('No matcher instance');
    }
    return this.matcher.match(raw, current, redirectedFrom);
};
Router.prototype.addRoutes = function addRoutes (routes) {
    if (!this.matcher) {
        throw new Error('No matcher instance');
    }
    this.matcher.addRoutes(routes);
    if (this.currentRoute !== START) {
        this.history.transitionTo(this.history.getCurrentLocation());
    }
};
function createHref(base, fullPath, mode) {
    var path = mode === 'hash' ? '#' + fullPath : fullPath;
    return base ? cleanPath(base + '/' + path) : path;
}
function registerHook(list, fn) {
    if (Array.isArray(list)) {
        list.push(fn);
        return function () {
            var i = list.indexOf(fn);
            if (i > -1)
                { list.splice(i, 1); }
        };
    }
    else {
        return function () { };
    }
}

var getRouter = function (options) {
	if ( options === void 0 ) options = {};

	return new Router(options);
};

exports.createMatcher = createMatcher;
exports.Matcher = Matcher;
exports.Router = Router;
exports.default = Router;
exports.getRouter = getRouter;

Object.defineProperty(exports, '__esModule', { value: true });

})));
