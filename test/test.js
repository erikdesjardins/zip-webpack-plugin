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

test('roundtrip', async t => {
	const out = randomPath();
	const outSrc = join(out, 'src');
	const outDst = join(out, 'dst');

	await runWithOptions({ path: outSrc, filename: 'bundle.js' });

	const zipFile = await new Promise((resolve, reject) => {
		yauzl.open(join(outSrc, 'bundle.js.zip'), { lazyEntries: true }, (err, zipFile) => {
			err ? reject(err) : resolve(zipFile);
		});
	});

	zipFile.readEntry();

	zipFile.on('entry', entry => {
		zipFile.openReadStream(entry, (err, readStream) => {
			if (err) throw err;
			mkdirp.sync(join(outDst, dirname(entry.fileName)));
			const writeStream = createWriteStream(join(outDst, entry.fileName));
			readStream.pipe(writeStream);
			writeStream.on('close', () => zipFile.readEntry());
		});
	});

	await new Promise((resolve, reject) => {
		zipFile.on('close', resolve);
		zipFile.on('error', reject);
	});

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
