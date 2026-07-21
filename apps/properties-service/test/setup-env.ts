// Runs before any test module is imported (jest setupFiles).
// Forces the dedicated test database unless the environment (e.g. CI) already set one.
process.env.PROPERTIES_DB_HOST ??= 'localhost';
process.env.PROPERTIES_DB_PORT ??= '5432';
process.env.PROPERTIES_DB_USER ??= 'propflow';
process.env.PROPERTIES_DB_PASSWORD ??= 'propflow';
process.env.PROPERTIES_DB_NAME ??= 'properties_test';
