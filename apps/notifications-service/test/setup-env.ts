// Runs before any test module is imported (jest setupFiles).
process.env.RABBITMQ_URL ??= 'amqp://propflow:propflow@localhost:5672';
