const pool = require('./connection');
const migrate = require('./migrate');

async function init() {
  try {
    await migrate();
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

if (require.main === module) {
  init()
    .then(() => {
      console.log('Database initialized successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = init;
