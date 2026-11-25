const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const catalog = require('../data/product-catalog.json');

const root = path.resolve(__dirname, '..');
const backendFlag = process.argv.indexOf('--backend');
const backend = path.resolve(
  backendFlag === -1 ? path.join(root, '..', 'burak') : process.argv[backendFlag + 1]
);
const apply = process.argv.includes('--apply');
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('dotenv').config({ path: path.join(backend, '.env') });
backendRequire('ts-node').register({
  project: path.join(backend, 'tsconfig.json'),
  transpileOnly: true,
});
const mongoose = backendRequire('mongoose');
const Product = backendRequire(path.join(backend, 'src/schema/Product.model.ts')).default;
const categories = ['DISH', 'SALAD', 'DESSERT', 'DRINK', 'OTHER'];

function countActive(products) {
  return Object.fromEntries(
    categories.map((category) => [
      category,
      products.filter(
        (p) => p.productCollection === category && p.productStatus === 'PROCESS'
      ).length,
    ])
  );
}

async function main() {
  if (!process.env.MONGO_URL) throw new Error('Backend MONGO_URL is missing.');
  try {
    await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  } catch {
    throw new Error('Could not connect to the configured Burak MongoDB database.');
  }
  try {
    const existing = await Product.find({}).lean();
    const counts = countActive(existing);
    const plan = [];
    for (const entry of catalog.products) {
      if (counts[entry.productCollection] >= catalog.targetPerCategory) continue;
      // Preserve existing products, including paused products and their images.
      if (
        existing.some(
          (p) =>
            p.productName.toLocaleLowerCase() === entry.productName.toLocaleLowerCase() &&
            p.productSize === entry.productSize &&
            p.productVolume === entry.productVolume
        )
      ) continue;

      const { key, image, ...fields } = entry;
      const source = path.resolve(root, image.localFile);
      if (!source.startsWith(`${path.join(root, 'public', 'img')}${path.sep}`)) {
        throw new Error(`Invalid local image: ${key}`);
      }
      const photo = await fs.readFile(source);
      if (photo.length < 1000) throw new Error(`Missing or incomplete image: ${key}`);
      const relativeImage = `uploads/products/catalog/${key}${path.extname(source)}`;
      const product = new Product({
        ...fields,
        productStatus: 'PROCESS',
        productViews: 0,
        productImages: [relativeImage],
      });
      await product.validate();
      plan.push({ source, relativeImage, product });
      counts[entry.productCollection] += 1;
    }
    if (Object.values(counts).some((count) => count < catalog.targetPerCategory)) {
      throw new Error('The catalog cannot fill all categories without changing existing products.');
    }
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      before: countActive(existing),
      additions: plan.length,
      after: counts,
      products: plan.map(({ product }) => `${product.productCollection}: ${product.productName}`),
    }, null, 2));
    if (!apply) return;

    await fs.mkdir(path.join(backend, 'uploads/products/catalog'), { recursive: true });
    const inserted = [];
    for (const { source, relativeImage, product } of plan) {
      await fs.copyFile(source, path.join(backend, relativeImage));
      // Only inserts: no existing product, price, stock, or view count is changed.
      await product.save();
      inserted.push({
        id: String(product._id),
        productName: product.productName,
        productCollection: product.productCollection,
      });
    }
    const after = countActive(await Product.find({}).lean());
    if (inserted.length) {
      await fs.writeFile(
        path.join(root, 'data/product-import-report.json'),
        `${JSON.stringify({ importedAt: new Date().toISOString(), inserted, counts: after }, null, 2)}\n`
      );
    }
    console.log(`Imported ${inserted.length} products. Counts: ${JSON.stringify(after)}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
