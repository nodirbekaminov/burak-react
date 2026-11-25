const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const catalog = require('../data/product-catalog.json');

const root = path.resolve(__dirname, '..');

function isImage(data) {
  return (
    (data[0] === 0xff && data[1] === 0xd8) ||
    (data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP') ||
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
}

async function download(product) {
  const { localFile, sourceUrl } = product.image;
  const destination = path.resolve(root, localFile);
  if (!destination.startsWith(`${path.join(root, 'public', 'img')}${path.sep}`)) {
    throw new Error(`Invalid image destination: ${product.key}`);
  }
  try {
    const current = await fs.readFile(destination);
    if (isImage(current)) return 'reused';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!sourceUrl) throw new Error(`Missing project image: ${localFile}`);
  const url = new URL(sourceUrl);
  if (
    url.protocol !== 'https:' ||
    !['www.themealdb.com', 'www.thecocktaildb.com'].includes(url.hostname)
  ) {
    throw new Error(`Unsupported image source: ${product.key}`);
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (!isImage(data) || data.length < 1000) {
        throw new Error('The response is not a valid product photo');
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, data);
      return 'downloaded';
    } catch (error) {
      if (attempt === 3) throw new Error(`${product.key}: ${error.message}`);
      await delay(attempt * 1000);
    }
  }
}

async function main() {
  const pending = [...catalog.products];
  const counts = { downloaded: 0, reused: 0 };
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (pending.length) {
        const product = pending.shift();
        const result = await download(product);
        counts[result] += 1;
        console.log(`${result}: ${product.key}`);
      }
    })
  );
  console.log(JSON.stringify(counts));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
