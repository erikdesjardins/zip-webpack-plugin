# zip-webpack-plugin [![Build Status](https://travis-ci.org/erikdesjardins/zip-webpack-plugin.svg?branch=master)](https://travis-ci.org/erikdesjardins/zip-webpack-plugin)

Webpack plugin to zip up emitted files.

Compresses all assets into a zip file.

## Installation

`npm install --save-dev zip-webpack-plugin`

## Usage

**webpack.config.js**

```js
var ZipPlugin = require('zip-webpack-plugin');

module.exports = {
  // ...
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  plugins: [
    new ZipPlugin({
      // OPTIONAL: defaults to the Webpack output path (above)
      path: 'zip', // can be relative (to Webpack output path) or absolute
      // OPTIONAL: defaults to the Webpack output filename (above) or,
      // if not present, the basename of the path
      filename: 'my_app.zip'
    })
  ]
};
```
