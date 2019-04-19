const fs = require('fs')
const path = require('path')

module.exports = {
  // Expose __dirname to allow automatically setting basename.
  context: __dirname,
  node: {
    __dirname: true
  },

  mode: process.env.NODE_ENV || 'development',

  entry: fs.readdirSync(__dirname).reduce((entries, dir) => {
    if (dir !== 'basic') {
      return entries;
    }
    const fullDir = path.join(__dirname, dir)
    const entry = path.join(fullDir, 'app.jsx')
    if (fs.statSync(fullDir).isDirectory() && fs.existsSync(entry)) {
      entries[dir] = [entry]
    }

    return entries
  }, {}),

  output: {
    path: path.join(__dirname, '__build__'),
    filename: '[name].js',
    chunkFilename: '[id].chunk.js',
    publicPath: '/__build__/'
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/i,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.jsx?$/i,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          'css-loader'
        ]
      }
    ]
  },

  resolve: {
    alias: {
      '@etsx/router': path.join(__dirname, '..', 'src')
    },
    extensions: ['.js', '.jsx', '.json', '.mjs', '.ts', '.tsx']
  },

  optimization: {
    splitChunks: {
      cacheGroups: {
        shared: {
          name: 'shared',
          chunks: 'initial',
          minChunks: 2
        }
      }
    }
  },

  plugins: [
  ]
}
