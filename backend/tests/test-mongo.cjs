const { MongoMemoryServer } = require('mongodb-memory-server');
const { existsSync, mkdirSync } = require('fs');
const tmpDir = process.env.TMPDIR || '/tmp/claude';
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

async function test() {
  try {
    const server = await MongoMemoryServer.create({
      instance: { port: 0, dbPath: tmpDir, args: ['--nounixsocket'] },
      binary: { systemBinary: '/opt/homebrew/bin/mongod' },
    });
    console.log('SUCCESS URI:', server.getUri());
    await server.stop();
    console.log('STOPPED OK');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
}
test();
