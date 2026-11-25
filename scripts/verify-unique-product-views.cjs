// Regression check against the local API using temporary, isolated fixtures.
// Only records created by this run are removed during cleanup.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { createRequire } = require('node:module');
const exec = promisify(execFile);
const backend = path.resolve(__dirname, '../../burak');
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('dotenv').config({ path: path.join(backend, '.env') });
backendRequire('ts-node').register({ project: path.join(backend, 'tsconfig.json'), transpileOnly: true });
const mongoose = backendRequire('mongoose');
const jwt = backendRequire('jsonwebtoken');
const Product = backendRequire(path.join(backend, 'src/schema/Product.model.ts')).default;
const View = backendRequire(path.join(backend, 'src/schema/View.model.ts')).default;
const Member = backendRequire(path.join(backend, 'src/schema/Member.model.ts')).default;
const baseUrl = 'http://localhost:3003';

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  } catch {
    throw new Error('Could not connect to the local backend database configuration.');
  }
  const suffix = crypto.randomBytes(8).toString('hex');
  const memberIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const productIds = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'burak-unique-views-'));
  try {
    await View.init();
    const environments = [];
    for (const [i, id] of memberIds.entries()) {
      const memberNick = `__view_test_${suffix}_${i}`;
      await Member.create({
        _id: id, memberNick, memberPhone: `test-${suffix}-${i}`,
        memberPassword: crypto.randomBytes(32).toString('hex'), memberType: 'USER',
      });
      const token = jwt.sign(
        { _id: String(id), memberNick, memberType: 'USER', memberStatus: 'ACTIVE' },
        process.env.SECRET_TOKEN, { expiresIn: '5m' }
      );
      const envPath = path.join(temp, `user-${i}.json`);
      await fs.writeFile(envPath, JSON.stringify({
        name: 'Temporary local view regression user',
        values: [{ key: 'test_token', value: token, enabled: true, type: 'secret' }],
        _postman_variable_scope: 'environment',
      }), { mode: 0o600 });
      environments.push(envPath);
    }
    for (const [i, id] of productIds.entries()) {
      await Product.create({
        _id: id, productName: `__view_test_${suffix}_${i}`,
        productCollection: 'OTHER', productStatus: 'PROCESS',
        productPrice: 1, productLeftCount: 1, productImages: [],
        productViews: i === 2 ? 4 : 0, createdAt: new Date('2000-01-01'),
      });
    }
    // An old view has no viewKey. It must continue preventing a repeat count.
    await View.create({ memberId: memberIds[0], viewRefId: productIds[2], viewGroup: 'PRODUCT' });

    async function request(label, productIndex, userIndex, expected) {
      const id = String(productIds[productIndex]);
      const countAssertion = expected === undefined
        ? 'pm.expect(body.productViews).to.be.within(0, 1);'
        : `pm.expect(body.productViews).to.eql(${expected});`;
      const args = [
        'request', 'GET', `${baseUrl}/product/${id}`, '--no-report-events',
        '--timeout', '15000', '--response-only',
        '--script-post-request',
        `pm.test('Product and unique view count', function() {
          pm.response.to.have.status(200);
          const body = pm.response.json();
          pm.expect(body._id).to.eql('${id}');
          ${countAssertion}
        });`,
      ];
      if (userIndex !== null) {
        args.push('-e', environments[userIndex], '-H', 'Cookie:accessToken={{test_token}}');
      }
      try {
        await exec('postman', args, { timeout: 45000, maxBuffer: 1024 * 1024 });
      } catch (error) {
        // The CLI request is response-only, so no credentials are printed.
        throw new Error(`${label} failed (exit ${error.code}): ${String(error.stdout || error.stderr).slice(-1800)}`);
      }
      console.log(`PASS: ${label}`);
    }

    const concurrent = await Promise.allSettled(
      Array.from({ length: 4 }, (_, i) => request(`Concurrent first view ${i + 1}`, 0, 0))
    );
    const failure = concurrent.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    assert.equal((await Product.findById(productIds[0])).productViews, 1);
    assert.equal(await View.countDocuments({ memberId: memberIds[0], viewRefId: productIds[0] }), 1);
    await request('Same user repeat stays at one', 0, 0, 1);
    await request('Second user adds exactly one', 0, 1, 2);
    await request('First user return stays at two', 0, 0, 2);
    await request('Second user repeat stays at two', 0, 1, 2);
    await request('Guest does not add an account view', 0, null, 2);
    await request('Another product has an independent first view', 1, 0, 1);
    await request('Historical view without a key is preserved', 2, 0, 4);
    console.log('Verified 11 HTTP checks and database uniqueness through the real local API.');
  } finally {
    await View.deleteMany({ viewRefId: { $in: productIds }, memberId: { $in: memberIds } });
    await Product.deleteMany({ _id: { $in: productIds } });
    await Member.deleteMany({ _id: { $in: memberIds } });
    await fs.rm(temp, { recursive: true, force: true });
    await mongoose.disconnect();
    console.log('Temporary test products, users, views, and credentials removed.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
