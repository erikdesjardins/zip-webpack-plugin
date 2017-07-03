/**
 * @author Erik Desjardins
 * See LICENSE file in root directory for full license.
 */

'use strict';

var path = require('path');
var ModuleFilenameHelpers = require('webpack/lib/ModuleFilenameHelpers');
var RawSource = require('webpack-sources').RawSource;
var yazl = require('yazl');

function ZipPlugin(options) {
	this.options = options || {};
	this.zipFile = new yazl.ZipFile();
	this.refCount = 0

	// accumulate each buffer containing a part of the zip file
	this.bufs = [];

	this.zipFile.outputStream.on('data', function(buf) {
		this.bufs.push(buf);
	}.bind(this));
}

ZipPlugin.prototype.apply = function(compiler) {
	this.refCount++;
	var self = this;
	var options = this.options;

    if (options.pathPrefix && path.isAbsolute(options.pathPrefix)) {
        throw new Error('"pathPrefix" must be a relative path');
    }

	compiler.plugin('emit', function(compilation, callback) {
		// assets from child compilers will be included in the parent
		// so we should not run in child compilers
		if (this.isChild()) {
			callback();
			return;
		}

		var pathPrefix = options.pathPrefix || '';

		// populate the zip file with each asset
		for (var nameAndPath in compilation.assets) {
			if (!compilation.assets.hasOwnProperty(nameAndPath)) continue;

			// match against include and exclude, which may be strings, regexes, arrays of the previous or omitted
			if (!ModuleFilenameHelpers.matchObject({ include: options.include, exclude: options.exclude }, nameAndPath)) continue;

			var source = compilation.assets[nameAndPath].source();

			self.zipFile.addBuffer(
				Buffer.isBuffer(source) ? source : new Buffer(source),
				path.join(pathPrefix, nameAndPath),
				options.fileOptions
			);
		}

		if(--self.refCount !== 0) {
			callback();
			return
		}

		self.zipFile.end(options.zipOptions);

		self.zipFile.outputStream.on('end', function() {
			// default to webpack's root output path if no path provided
			var outputPath = options.path || compilation.options.output.path;
			// default to webpack root filename if no filename provided, else the basename of the output path
			var outputFilename = options.filename || compilation.options.output.filename || path.basename(outputPath);

			var extension = '.' + (options.extension || 'zip');

			// combine the output path and filename
			var outputPathAndFilename = path.resolve(
				compilation.options.output.path, // ...supporting both absolute and relative paths
				outputPath,
				path.basename(outputFilename, '.zip') + extension // ...and filenames with and without a .zip extension
			);

			// resolve a relative output path with respect to webpack's root output path
			// since only relative paths are permitted for keys in `compilation.assets`
			var relativeOutputPath = path.relative(
				compilation.options.output.path,
				outputPathAndFilename
			);

			// add our zip file to the assets
			compilation.assets[relativeOutputPath] = new RawSource(Buffer.concat(self.bufs));

			callback();
		});
	});
};

module.exports = ZipPlugin;
