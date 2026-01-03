require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== DATABASE ================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

/* ================== SCHEMAS ================== */
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const InvoiceItemSchema = new mongoose.Schema({
  particular: String,
  quantity: Number,
  rate: Number,
  amount: Number
});

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: String,
  invoiceDate: String,
  items: [InvoiceItemSchema],
  totalAmount: Number,
  receivedAmount: Number,
  previousBalance: Number,
  currentBalance: Number,
  createdAt: { type: Date, default: Date.now }
});

const CustomerSchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  email: String,
  gstin: String,
  invoices: [InvoiceSchema]
});

const User = mongoose.model('User', UserSchema);
const Customer = mongoose.model('Customer', CustomerSchema);

/* ================== MIDDLEWARE ================== */
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

/* ================== PAGES ================== */
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/login.html'))
);

app.get('/customers.html', auth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public/customers.html'))
);

app.get('/customer-invoices.html', auth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public/customer-invoices.html'))
);

app.get('/invoice.html', auth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public/invoice.html'))
);

/* ================== AUTH ================== */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.json({ success: false });

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.json({ success: false });

  req.session.userId = user._id;
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.userId });
});

/* ================== CUSTOMERS ================== */
app.get('/api/customers', auth, async (req, res) => {
  const customers = await Customer.find({}, { invoices: 0 });
  res.json(customers);
});

app.post('/api/customers', auth, async (req, res) => {
  await Customer.create(req.body);
  res.json({ success: true });
});

app.delete('/api/customers/:id', auth, async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Error deleting customer' });
  }
});

app.get('/api/customers/:id', auth, async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

app.get('/api/customers/:id/latest-balance', auth, async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const last = customer.invoices.at(-1);
  res.json({ balance: last ? last.currentBalance : 0 });
});

/* ================== INVOICES ================== */
app.get('/api/customers/:id/invoices', auth, async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
  // Sort invoices by creation date (newest first)
  const sortedInvoices = customer.invoices.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  res.json(sortedInvoices);
});

app.post('/api/invoices', auth, async (req, res) => {
  const { customerId, invoiceNumber, invoiceDate, items, receivedAmount, previousBalance } = req.body;

  const total = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const current = total - receivedAmount + previousBalance;

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    {
      $push: {
        invoices: {
          invoiceNumber,
          invoiceDate,
          items,
          totalAmount: total,
          receivedAmount,
          previousBalance,
          currentBalance: current
        }
      }
    },
    { new: true }
  );

  const newInvoice = customer.invoices.at(-1);
  res.json({ success: true, id: newInvoice._id });
});

app.get('/api/invoices/:id', auth, async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const customer = await Customer.findOne({ 'invoices._id': req.params.id });
    if (!customer) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = customer.invoices.id(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    res.json({
      ...invoice.toObject(),
      customer_name: customer.name,
      address: customer.address,
      customer_id: customer._id
    });
  } catch (error) {
    console.error('Error loading invoice:', error);
    res.status(500).json({ error: 'Error loading invoice' });
  }
});

app.put('/api/invoices/:id', auth, async (req, res) => {
  const { invoiceNumber, invoiceDate, items, receivedAmount, previousBalance } = req.body;
  const invoiceId = req.params.id;

  try {
    const total = items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const current = total - receivedAmount + previousBalance;

    const customer = await Customer.findOne({ 'invoices._id': invoiceId });
    if (!customer) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = customer.invoices.id(invoiceId);
    invoice.invoiceNumber = invoiceNumber;
    invoice.invoiceDate = invoiceDate;
    invoice.items = items;
    invoice.totalAmount = total;
    invoice.receivedAmount = receivedAmount;
    invoice.previousBalance = previousBalance;
    invoice.currentBalance = current;

    await customer.save();
    res.json({ success: true, id: invoiceId });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Error updating invoice' });
  }
});

app.delete('/api/invoices/:id', auth, async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const customer = await Customer.findOne({ 'invoices._id': req.params.id });
    if (!customer) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = customer.invoices.id(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Use pull method instead of remove for newer Mongoose versions
    customer.invoices.pull({ _id: req.params.id });
    await customer.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Error deleting invoice' });
  }
});

app.get('/api/customers/:id/statement', auth, async (req, res) => {
  const { fromDate, toDate } = req.query;
  const customerId = req.params.id;

  if (!customerId || customerId === 'undefined') {
    return res.status(400).json({ error: 'Invalid customer ID' });
  }

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    // Get opening balance (last invoice before fromDate)
    const invoicesBeforeRange = customer.invoices.filter(
      inv => new Date(inv.invoiceDate) < fromDateObj
    );
    const openingBalance = invoicesBeforeRange.length > 0
      ? invoicesBeforeRange[invoicesBeforeRange.length - 1].currentBalance
      : 0;

    // Get invoices in date range
    const invoicesInRange = customer.invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      return invDate >= fromDateObj && invDate <= toDateObj;
    });

    res.json({
      customer: {
        name: customer.name,
        address: customer.address,
        phone: customer.phone,
        gstin: customer.gstin
      },
      openingBalance,
      invoices: invoicesInRange
    });
  } catch (error) {
    console.error('Error generating statement:', error);
    res.status(500).json({ error: 'Error generating statement' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
