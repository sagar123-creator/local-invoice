require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* DB */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/* Middleware */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/image', express.static('image'));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

function auth(req, res, next) {
  if (!req.session.userId) return res.redirect('/');
  next();
}

/* Pages */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/customers.html', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/customers.html'));
});

app.get('/customer-invoices.html', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/customer-invoices.html'));
});

app.get('/invoice.html', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/invoice.html'));
});

/* Auth API */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE username=?', [username]);
  if (!rows.length) return res.json({ success: false });

  const ok = bcrypt.compareSync(password, rows[0].password);
  if (!ok) return res.json({ success: false });

  req.session.userId = rows[0].id;
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.userId });
});

/* Customers */
app.get('/api/customers', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM customers ORDER BY name');
  res.json(rows);
});

app.post('/api/customers', auth, async (req, res) => {
  const { name, address, phone, email, gstin } = req.body;
  await db.query(
    'INSERT INTO customers (name,address,phone,email,gstin) VALUES (?,?,?,?,?)',
    [name, address, phone, email, gstin]
  );
  res.json({ success: true });
});

app.get('/api/customers/:id', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM customers WHERE id=?', [req.params.id]);
  res.json(rows[0]);
});

app.get('/api/customers/:id/latest-balance', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT current_balance FROM invoices WHERE customer_id=? ORDER BY created_at DESC LIMIT 1',
    [req.params.id]
  );
  res.json({ balance: rows.length ? rows[0].current_balance : 0 });
});

/* Invoices */
app.get('/api/customers/:id/invoices', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM invoices WHERE customer_id=? ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json(rows);
});

app.get('/api/invoices/:id', auth, async (req, res) => {
  const [[invoice]] = await db.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id=?', [req.params.id]);
  invoice.items = items;
  res.json(invoice);
});

app.post('/api/invoices', auth, async (req, res) => {
  const { customerId, invoiceNumber, invoiceDate, items, receivedAmount, previousBalance } = req.body;
  let total = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  let current = total - receivedAmount + previousBalance;

  const [r] = await db.query(
    `INSERT INTO invoices (customer_id,invoice_number,invoice_date,total_amount,received_amount,previous_balance,current_balance)
     VALUES (?,?,?,?,?,?,?)`,
    [customerId, invoiceNumber, invoiceDate, total, receivedAmount, previousBalance, current]
  );

  for (let i of items) {
    await db.query(
      'INSERT INTO invoice_items (invoice_id,particular,quantity,rate,amount) VALUES (?,?,?,?,?)',
      [r.insertId, i.particular, i.quantity, i.rate, i.quantity * i.rate]
    );
  }

  res.json({ success: true, id: r.insertId });
});

/* Start */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
