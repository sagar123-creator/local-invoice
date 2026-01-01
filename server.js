require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= DATABASE ================= */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/image', express.static(path.join(__dirname, 'image')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false
  })
);

/* ================= AUTH ================= */
function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  next();
}

/* ================= ROUTES ================= */

// Home → login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT id, password FROM users WHERE username = ?',
      [username]
    );

    if (!rows.length) {
      return res.json({ success: false });
    }

    const match = bcrypt.compareSync(password, rows[0].password);
    if (!match) {
      return res.json({ success: false });
    }

    req.session.userId = rows[0].id;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Auth check
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.userId });
});

// Pages
app.get('/customers.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customers.html'));
});

app.get('/invoice.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

/* ================= API : CUSTOMERS ================= */

// Get all customers
app.get('/api/customers', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM customers ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

// Get single customer
app.get('/api/customers/:id', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM customers WHERE id = ?',
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// Create customer
app.post('/api/customers', isAuthenticated, async (req, res) => {
  try {
    const { name, address, phone, email, gstin } = req.body;
    
    const [result] = await db.query(
      'INSERT INTO customers (name, address, phone, email, gstin) VALUES (?, ?, ?, ?, ?)',
      [name, address || null, phone || null, email || null, gstin || null]
    );
    
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Delete customer
app.delete('/api/customers/:id', isAuthenticated, async (req, res) => {
  try {
    // First delete all invoices for this customer
    await db.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id = ?)', [req.params.id]);
    await db.query('DELETE FROM invoices WHERE customer_id = ?', [req.params.id]);
    
    // Then delete the customer
    await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Get customer's latest balance
app.get('/api/customers/:id/latest-balance', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT current_balance as balance 
       FROM invoices 
       WHERE customer_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.params.id]
    );
    
    if (!rows.length) {
      return res.json({ balance: 0 });
    }
    
    res.json({ balance: rows[0].balance || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get customer's invoices
app.get('/api/customers/:id/invoices', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, invoice_number, invoice_date, total_amount, created_at
       FROM invoices 
       WHERE customer_id = ? 
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

/* ================= API : INVOICES ================= */

// Get single invoice
app.get('/api/invoices/:id', isAuthenticated, async (req, res) => {
  try {
    const [invoiceRows] = await db.query(
      `SELECT i.*, c.name as customer_name, c.address 
       FROM invoices i 
       JOIN customers c ON i.customer_id = c.id 
       WHERE i.id = ?`,
      [req.params.id]
    );
    
    if (!invoiceRows.length) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = invoiceRows[0];
    
    // Get invoice items
    const [itemRows] = await db.query(
      'SELECT particular, quantity, rate FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [req.params.id]
    );
    
    invoice.items = itemRows;
    
    res.json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
});

// Create invoice
app.post('/api/invoices', isAuthenticated, async (req, res) => {
  try {
    const { customerId, invoiceNumber, invoiceDate, items, receivedAmount, previousBalance } = req.body;
    
    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const currentBalance = totalAmount - (receivedAmount || 0) + (previousBalance || 0);
    
    // Insert invoice
    const [result] = await db.query(
      `INSERT INTO invoices 
       (customer_id, invoice_number, invoice_date, total_amount, received_amount, previous_balance, current_balance) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customerId, invoiceNumber, invoiceDate, totalAmount, receivedAmount || 0, previousBalance || 0, currentBalance]
    );
    
    const invoiceId = result.insertId;
    
    // Insert invoice items
    for (const item of items) {
      const amount = item.quantity * item.rate;
      await db.query(
        'INSERT INTO invoice_items (invoice_id, particular, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)',
        [invoiceId, item.particular, item.quantity, item.rate, amount]
      );
    }
    
    res.json({ id: invoiceId, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
app.put('/api/invoices/:id', isAuthenticated, async (req, res) => {
  try {
    const { invoiceNumber, invoiceDate, items, receivedAmount, previousBalance } = req.body;
    
    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const currentBalance = totalAmount - (receivedAmount || 0) + (previousBalance || 0);
    
    // Update invoice
    await db.query(
      `UPDATE invoices 
       SET invoice_number = ?, invoice_date = ?, total_amount = ?, 
           received_amount = ?, previous_balance = ?, current_balance = ?
       WHERE id = ?`,
      [invoiceNumber, invoiceDate, totalAmount, receivedAmount || 0, previousBalance || 0, currentBalance, req.params.id]
    );
    
    // Delete old items
    await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    
    // Insert new items
    for (const item of items) {
      const amount = item.quantity * item.rate;
      await db.query(
        'INSERT INTO invoice_items (invoice_id, particular, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, item.particular, item.quantity, item.rate, amount]
      );
    }
    
    res.json({ id: req.params.id, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', isAuthenticated, async (req, res) => {
  try {
    // Delete invoice items first
    await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    
    // Delete invoice
    await db.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
