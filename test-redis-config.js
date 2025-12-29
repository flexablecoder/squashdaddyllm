const Redis = require('ioredis');

async function test() {
    console.log('Testing ioredis with { url: ... } config...');
    // Point to a non-existent port to force connection error if it tries to use it
    // But if it ignores it, it will try localhost:6379 (default)

    const options = {
        // This is what I committed
        url: 'redis://127.0.0.1:9999',
        // If it uses this, it fails with ECONNREFUSED 127.0.0.1:9999
        // If it ignores this, it uses localhost:6379 options (defaults) => ECONNREFUSED 127.0.0.1:6379
        maxRetriesPerRequest: 0,
        retryStrategy: () => null, // Stop immediately
    };

    try {
        const redis = new Redis(options);
        redis.on('error', (err) => {
            console.error('Redis Error:', err.message);
            console.error('Address:', err.address, 'Port:', err.port);
            process.exit(0); // Exit after error
        });

        await redis.ping();
    } catch (error) {
        console.error('Catch Error:', error.message);
    }
}

test();
