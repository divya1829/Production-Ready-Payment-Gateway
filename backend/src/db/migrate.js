const fs = require('fs');
const path = require('path');
const pool = require('./connection');

async function migrate() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema migrated successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// If run directly, execute migration
if (require.main === module) {
  migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrate;
