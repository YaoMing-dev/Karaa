const redis = require('redis');
require('dotenv').config();

// Check if Redis is configured
const isRedisConfigured = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

// Create Redis client only if configured
let redisClient = null;

if (isRedisConfigured) {
  redisClient = process.env.REDIS_URL
    ? redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.log('❌ Redis max retries reached, stopping reconnection');
              return new Error('Max retries reached');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`⏳ Redis reconnecting in ${delay}ms... (attempt ${retries})`);
            return delay;
          },
          connectTimeout: 10000
        }
      })
    : redis.createClient({
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || undefined,
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.log('❌ Redis max retries reached, stopping reconnection');
              return new Error('Max retries reached');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`⏳ Redis reconnecting in ${delay}ms... (attempt ${retries})`);
            return delay;
          },
          connectTimeout: 10000
        },
        database: parseInt(process.env.REDIS_DB) || 0
      });
} else {
  console.log('ℹ️  Redis not configured - caching will be disabled');
}

// Error handling - prevent crash on connection errors (only if Redis is configured)
if (redisClient) {
  redisClient.on('error', (err) => {
    // Only log, don't throw or crash
    if (err.code !== 'ENOTFOUND' && err.code !== 'ECONNREFUSED') {
      console.error('❌ Redis Client Error:', err);
    }
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
  });
}

// Connect to Redis
const connectRedis = async () => {
  // Skip if Redis is not configured
  if (!redisClient) {
    console.log('⏭️  Skipping Redis connection (not configured)');
    return false;
  }

  try {
    await redisClient.connect();
    return true;
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    return false;
  }
};

// Cache helper functions
const cacheHelpers = {
  // Get cached data
  get: async (key) => {
    if (!redisClient || !redisClient.isOpen) {
      return null;
    }
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Set cache with TTL
  set: async (key, value, ttl = 3600) => {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  // Delete cache
  del: async (key) => {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  // Delete multiple keys by pattern
  delPattern: async (pattern) => {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  // Increment counter
  incr: async (key) => {
    if (!redisClient || !redisClient.isOpen) {
      return null;
    }
    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return null;
    }
  },

  // Set expiration time
  expire: async (key, seconds) => {
    if (!redisClient || !redisClient.isOpen) {
      return false;
    }
    try {
      await redisClient.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  }
};

module.exports = {
  redisClient,
  connectRedis,
  cache: cacheHelpers
};
