// Runs before any test module is imported (jest setupFiles).
// Forces the dedicated test database unless the environment (e.g. CI) already set one.
process.env.WORK_ORDERS_DB_HOST ??= 'localhost';
process.env.WORK_ORDERS_DB_PORT ??= '5432';
process.env.WORK_ORDERS_DB_USER ??= 'propflow';
process.env.WORK_ORDERS_DB_PASSWORD ??= 'propflow';
process.env.WORK_ORDERS_DB_NAME ??= 'work_orders_test';
