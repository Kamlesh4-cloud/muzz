  const Redis = require("ioredis");

  const redis = new Redis({
    host: "redis-12293.c15.us-east-1-2.ec2.redns.redis-cloud.com",
    port: 12293,
    password: "Lp89bLQ8PVIUNUo8AQMJXtNhgrGmCSvU",  // Ensure you have the correct password in .env
    tls: false // ✅ Explicitly disable TLS (remove if Redis supports TLS)
  });

  redis.on("connect", () => console.log("✅ Redis Connected"));
  redis.on("error", (err) => console.error("❌ Redis Connection Error:", err));

  module.exports = redis;
