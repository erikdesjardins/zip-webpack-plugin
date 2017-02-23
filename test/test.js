import { createWriteStream, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';

import test from 'ava';
import webpack from 'webpack';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import yauzl from 'yauzl';

import ZipPlugin from '../index';

function randomPath() {
	return join(__dirname, 'dist', String(Math.random()).slice(2));
}

function runWithOptions({ path, filename }, options) {
	return new Promise((resolve, reject) => {
		webpack({
			entry: join(__dirname, 'src', 'app'),
			bail: true,
			output: {
				path,
				filename
			},
			plugins: [
				new ZipPlugin(options)
			]
		}, (err, stats) => {
			err ? reject(err) : resolve(stats);
		});
	});
}

test('basic', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' });

	const byeJpg = readFileSync(join(out, 'subdir', 'bye.jpg'));
	const bundleJs = readFileSync(join(out, 'bundle.js'));
	const spawnedJs = readFileSync(join(out, 'spawned.js'));
	const bundleJsZip = readFileSync(join(out, 'bundle.js.zip'));

	t.ok(byeJpg);
	t.regex(bundleJs, /var a = 'b';/);
	t.regex(spawnedJs, /var foo = 'bar';/);
	t.ok(bundleJsZip);
});

async function unzip(zipFilePath, outDirPath) {
	const zipFile = await new Promise((resolve, reject) => {
		yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipFile) => {
			err ? reject(err) : resolve(zipFile);
		});
	});

	zipFile.readEntry();

	zipFile.on('entry', entry => {
		zipFile.openReadStream(entry, (err, readStream) => {
			if (err) throw err;
			mkdirp.sync(join(outDirPath, dirname(entry.fileName)));
			const writeStream = createWriteStream(join(outDirPath, entry.fileName));
			readStream.pipe(writeStream);
			writeStream.on('close', () => zipFile.readEntry());
		});
	});

	await new Promise((resolve, reject) => {
		zipFile.on('close', resolve);
		zipFile.on('error', reject);
	});
}

test('roundtrip', async t => {
	const out = randomPath();
	const outSrc = join(out, 'src');
	const outDst = join(out, 'dst');

	await runWithOptions({ path: outSrc, filename: 'bundle.js' });

	await unzip(join(outSrc, 'bundle.js.zip'), outDst);

	t.is(Buffer.compare(
		readFileSync(join(outSrc, 'subdir', 'bye.jpg')),
		readFileSync(join(outDst, 'subdir', 'bye.jpg'))
	), 0);
	t.is(Buffer.compare(
		readFileSync(join(outSrc, 'bundle.js')),
		readFileSync(join(outDst, 'bundle.js'))
	), 0);
	t.is(Buffer.compare(
		readFileSync(join(outSrc, 'spawned.js')),
		readFileSync(join(outDst, 'spawned.js'))
	), 0);
});

async function roundtrip(options) {
	const out = randomPath();
	const outSrc = join(out, 'src');
	const outDst = join(out, 'dst');

	await runWithOptions({ path: outSrc, filename: 'bundle.js' }, options);

	await unzip(join(outSrc, 'bundle.js.zip'), outDst);

	return outDst;
}

test('exclude string', async t => {
	const out = await roundtrip({ exclude: 'spawned.js' });

	t.ok(readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.throws(() => readFileSync(join(out, 'spawned.js')));
});

test('include string', async t => {
	const out = await roundtrip({ include: 'spawned.js' });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.throws(() => readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('exclude regex', async t => {
	const out = await roundtrip({ exclude: /\.jpg$/ });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('include regex', async t => {
	const out = await roundtrip({ include: /\.js$/ });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('multiple excludes', async t => {
	const out = await roundtrip({ exclude: [/\.jpg$/, 'bundle.js'] });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.throws(() => readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('multiple includes', async t => {
	const out = await roundtrip({ include: [/\.jpg$/, 'bundle.js'] });

	t.ok(readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.throws(() => readFileSync(join(out, 'spawned.js')));
});

test('exclude overrides include', async t => {
	const out = await roundtrip({ include: [/\.jpg$/, /\.js$/], exclude: ['bundle.js'] });

	t.ok(readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.throws(() => readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('exclude dir', async t => {
	const out = await roundtrip({ exclude: 'subdir/' });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('loaders not tested for include', async t => {
	const out = await roundtrip({ include: /file/i });

	t.throws(() => readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.throws(() => readFileSync(join(out, 'bundle.js')));
	t.throws(() => readFileSync(join(out, 'spawned.js')));
});

test('loaders not tested for exclude', async t => {
	const out = await roundtrip({ exclude: /file/i });

	t.ok(readFileSync(join(out, 'subdir', 'bye.jpg')));
	t.ok(readFileSync(join(out, 'bundle.js')));
	t.ok(readFileSync(join(out, 'spawned.js')));
});

test('fileOptions', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, {
		fileOptions: {
			mtime: new Date('2016-01-01Z'),
			mode: 0o100664,
			forceZip64Format: true,
			compress: false,
		},
	});

	t.is(readFileSync(join(out, 'bundle.js.zip')).length, 59903);
});

test('zipOptions', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, {
		zipOptions: {
			forceZip64Format: true,
		},
	});

	t.is(readFileSync(join(out, 'bundle.js.zip')).length, 57038);
});

test('fileOptions and zipOptions', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, {
		fileOptions: {
			mtime: new Date('2015-01-01Z'),
			mode: 0o100665,
			forceZip64Format: true,
		},
		zipOptions: {
			forceZip64Format: true,
		},
	});

	t.is(readFileSync(join(out, 'bundle.js.zip')).length, 57122);
});

test('pathPrefix', async t => {
    const out = await roundtrip({pathPrefix: 'prefix'});

    t.ok(readFileSync(join(out, 'prefix', 'subdir', 'bye.jpg')));
    t.ok(readFileSync(join(out, 'prefix','bundle.js')));
});

test('pathPrefix', async t => {
    t.throws(() => {
    	const plugin = new ZipPlugin({pathPrefix: '/prefix'});
    	plugin.apply();
    });
});

test('naming - default options, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out });
	t.ok(readFileSync(join(out, basename(out) + '.zip')), '.zip exists');
});

test('naming - default options, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' });
	t.ok(readFileSync(join(out, 'bundle.js.zip')), '.zip exists');
});

test('naming - specified filename with .zip, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { filename: 'my_app.zip' });
	t.ok(readFileSync(join(out, 'my_app.zip')), '.zip exists');
});

test('naming - specified filename without .zip, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { filename: 'my_app' });
	t.ok(readFileSync(join(out, 'my_app.zip')), '.zip exists');
});

test('naming - specified filename with .zip, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, { filename: 'my_app.zip' });
	t.ok(readFileSync(join(out, 'my_app.zip')), '.zip exists');
});

test('naming - specified filename and extension, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { filename:'file', ext: 'ext'})
	t.ok(readFileSync(join(out, 'file.ext')));
});

test('naming - specified relative path, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { path: 'zip' });
	t.ok(readFileSync(join(out, 'zip', 'zip.zip')), '.zip exists');
});

test('naming - specified relative path with slash, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { path: './zip' });
	t.ok(readFileSync(join(out, 'zip', 'zip.zip')), '.zip exists');
});

test('naming - specified relative path with parent, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: join(out, 'bin') }, { path: '../zip' });
	t.ok(readFileSync(join(out, 'zip', 'zip.zip')), '.zip exists');
});

test('naming - specified absolute path, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { path: join(out, 'zip') });
	t.ok(readFileSync(join(out, 'zip', 'zip.zip')), '.zip exists');
});

test('naming - specified relative path, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, { path: 'zip' });
	t.ok(readFileSync(join(out, 'zip', 'bundle.js.zip')), '.zip exists');
});

test('naming - specified absolute path, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, { path: join(out, 'zip') });
	t.ok(readFileSync(join(out, 'zip', 'bundle.js.zip')), '.zip exists');
});

test('naming - both specified, relative, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { path: 'zip', filename: 'archive' });
	t.ok(readFileSync(join(out, 'zip', 'archive.zip')), '.zip exists');
});

test('naming - both specified, absolute, no webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out }, { path: join(out, 'zip'), filename: 'archive' });
	t.ok(readFileSync(join(out, 'zip', 'archive.zip')), '.zip exists');
});

test('naming - both specified, relative, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, { path: 'zip', filename: 'archive' });
	t.ok(readFileSync(join(out, 'zip', 'archive.zip')), '.zip exists');
});

test('naming - both specified, absolute, with webpack filename', async t => {
	const out = randomPath();
	await runWithOptions({ path: out, filename: 'bundle.js' }, { path: join(out, 'zip'), filename: 'archive' });
	t.ok(readFileSync(join(out, 'zip', 'archive.zip')), '.zip exists');
});

test.after(() => {
	rimraf.sync(join(__dirname, 'dist'));
});
