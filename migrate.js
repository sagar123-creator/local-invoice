const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'invoice.db'));

console.log('Adding new columns to invoices table...');

db.serialize(() => {
  // Add received_amount column
  db.run(`ALTER TABLE invoices ADD COLUMN received_amount REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding received_amount:', err.message);
    } else {
      console.log('✓ received_amount column added');
    }
  });

  // Add previous_balance column
  db.run(`ALTER TABLE invoices ADD COLUMN previous_balance REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding previous_balance:', err.message);
    } else {
      console.log('✓ previous_balance column added');
    }
  });

  // Add current_balance column
  db.run(`ALTER TABLE invoices ADD COLUMN current_balance REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding current_balance:', err.message);
    } else {
      console.log('✓ current_balance column added');
    }
    
    // Close database after all operations
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('\nMigration complete! You can now start the server.');
        }
      });
    }, 1000);
  });
});
