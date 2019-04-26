const path = require('path')
const buble = require('rollup-plugin-buble')
const cjs = require('rollup-plugin-commonjs')
const node = require('rollup-plugin-node-resolve')
const replace = require('rollup-plugin-replace')
const version = process.env.VERSION || require('../package.json').version
const banner =
`/*!
  * etsx-router v${version}
  * (c) ${new Date().getFullYear()} yuchonghua
  * @license MIT
  */`

const resolve = _path => path.resolve(__dirname, '../', _path)

module.exports = [
  // browser dev
  {
    file: resolve('dist/etsx-router.js'),
    format: 'umd',
    env: 'development'
  },
  {
    file: resolve('dist/etsx-router.min.js'),
    format: 'umd',
    env: 'production'
  },
  {
    file: resolve('dist/etsx-router.common.js'),
    format: 'cjs'
  },
  {
    file: resolve('dist/etsx-router.esm.js'),
    format: 'es'
  },
  {
    file: resolve('dist/etsx-router.esm.browser.js'),
    format: 'es',
    env: 'development',
    transpile: false
  },
  {
    file: resolve('dist/etsx-router.esm.browser.min.js'),
    format: 'es',
    env: 'production',
    transpile: false
  }
].map(genConfig)

function genConfig (opts) {
  const config = {
    input: {
      input: resolve('src/index.ts'),
      plugins: [
        node(),
        cjs(),
        replace({
          __VERSION__: version
        })
      ]
    },
    output: {
      file: opts.file,
      format: opts.format,
      banner,
      name: 'EtsxRouter'
    }
  }

  if (opts.env) {
    config.input.plugins.unshift(replace({
      'process.env.NODE_ENV': JSON.stringify(opts.env)
    }))
  }

  if (opts.transpile !== false) {
    config.input.plugins.push(buble())
  }

  return config
}
