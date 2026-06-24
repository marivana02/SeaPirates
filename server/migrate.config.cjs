const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  migrationsDir: path.join(__dirname, 'migrations'),
  direction: 'up',
};
