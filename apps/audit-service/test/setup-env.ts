process.env.AUDIT_DB_HOST ??= 'localhost';
process.env.AUDIT_DB_PORT ??= '5432';
process.env.AUDIT_DB_USER ??= 'propflow';
process.env.AUDIT_DB_PASSWORD ??= 'propflow';
process.env.AUDIT_DB_NAME ??= 'audit_test';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
// A fresh group per run starts with no committed offsets, so the consumer
// replays the topic from the beginning — the suite exercises the same
// "rebuild the projection from history" path a real backfill would use.
process.env.AUDIT_CONSUMER_GROUP ??= `audit-service-e2e-${Date.now()}`;
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
