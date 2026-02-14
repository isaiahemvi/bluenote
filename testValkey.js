const client = require('./valkeyClient');

async function test() {
  await client.set('test', 'hello');
  const val = await client.get('test');
  console.log(val);
  process.exit();
}

test();
