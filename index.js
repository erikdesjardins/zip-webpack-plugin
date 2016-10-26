/**
 * @author Erik Desjardins
 * See LICENSE file in root directory for full license.
 */

'use strict';

var path = require('path');
var RawSource = require('webpack-sources').RawSource;
var yazl = require('yazl');

function ZipPlugin(options) {
	this.options = options || {};
}

ZipPlugin.prototype.apply = function(compiler) {
	var options = this.options;

	compiler.plugin('emit', function(compilation, callback) {
		// assets from child compilers will be included in the parent
		// so we should not run in child compilers
		if (this.isChild()) {
			callback();
			return;
		}

		var zipFile = new yazl.ZipFile();

		// populate the zip file with each asset
		for (var nameAndPath in compilation.assets) {
			if (!compilation.assets.hasOwnProperty(nameAndPath)) continue;

			var source = compilation.assets[nameAndPath].source();

			zipFile.addBuffer(
				Buffer.isBuffer(source) ? source : new Buffer(source),
				nameAndPath
			);
		}

		zipFile.end();

		// accumulate each buffer containing a part of the zip file
		var bufs = [];

		zipFile.outputStream.on('data', function(buf) {
			bufs.push(buf);
		});

		zipFile.outputStream.on('end', function() {
			// default to webpack's root output path if no path provided
			var outputPath = options.path || compilation.options.output.path;
			// default to webpack root filename if no filename provided, else the basename of the output path
			var outputFilename = options.filename || compilation.options.output.filename || path.basename(outputPath);

			// combine the output path and filename
			var outputPathAndFilename = path.resolve(
				compilation.options.output.path, // ...supporting both absolute and relative paths
				outputPath,
				path.basename(outputFilename, '.zip') + '.zip' // ...and filenames with and without a .zip extension
			);

			// resolve a relative output path with respect to webpack's root output path
			// since only relative paths are permitted for keys in `compilation.assets`
			var relativeOutputPath = path.relative(
				compilation.options.output.path,
				outputPathAndFilename
			);

			// add our zip file to the assets
			compilation.assets[relativeOutputPath] = new RawSource(Buffer.concat(bufs));

			callback();
		});
	});
};

module.exports = ZipPlugin;
