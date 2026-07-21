// Runs before any test module is imported (jest setupFiles).
// The full-stack suite boots the real downstream services in-process, so it
// needs their test databases and the local broker.
process.env.WORK_ORDERS_DB_HOST ??= 'localhost';
process.env.WORK_ORDERS_DB_PORT ??= '5432';
process.env.WORK_ORDERS_DB_USER ??= 'propflow';
process.env.WORK_ORDERS_DB_PASSWORD ??= 'propflow';
process.env.WORK_ORDERS_DB_NAME ??= 'work_orders_test';
process.env.PROPERTIES_DB_HOST ??= 'localhost';
process.env.PROPERTIES_DB_PORT ??= '5432';
process.env.PROPERTIES_DB_USER ??= 'propflow';
process.env.PROPERTIES_DB_PASSWORD ??= 'propflow';
process.env.PROPERTIES_DB_NAME ??= 'properties_test';
process.env.RABBITMQ_URL ??= 'amqp://propflow:propflow@localhost:5672';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
