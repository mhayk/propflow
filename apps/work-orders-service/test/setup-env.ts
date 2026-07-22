// Runs before any test module is imported (jest setupFiles).
// Forces the dedicated test database unless the environment (e.g. CI) already set one.
process.env.WORK_ORDERS_DB_HOST ??= 'localhost';
process.env.WORK_ORDERS_DB_PORT ??= '5432';
process.env.WORK_ORDERS_DB_USER ??= 'propflow';
process.env.WORK_ORDERS_DB_PASSWORD ??= 'propflow';
process.env.WORK_ORDERS_DB_NAME ??= 'work_orders_test';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
// Faster outbox drains keep the event-loop e2e assertions snappy.
process.env.OUTBOX_POLL_MS ??= '100';
