import { readFileSync } from 'fs';
import { join } from 'path';

import test from 'ava';
import webpack from 'webpack';
import rimraf from 'rimraf';

import ZipPlugin from '../index';

function randomPath() {
	return join(__dirname, 'dist', String(Math.random()).slice(2));
}

function runWithOptions(outputPath, options) {
	return new Promise((resolve, reject) => {
		webpack({
			entry: join(__dirname, 'src', 'app'),
			bail: true,
			output: {
				path: outputPath,
				filename: 'my_bundle.js'
			},
			plugins: [
				new ZipPlugin(options)
			]
		}, (err, stats) => {
			err ? reject(err) : resolve(stats);
		});
	});
}

test('default options', async t => {
	const out = randomPath();

	await runWithOptions(out, undefined);

	t.ok(readFileSync(join(out, 'my_bundle.js')), '.zip exists');
});

test.after(() => {
	rimraf.sync(join(__dirname, 'dist'));
});
