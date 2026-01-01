let customerId = null;
let customer = null;

async function checkAuth() {
  const response = await fetch('/api/auth/check');
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = '/login.html';
  } else {
    document.getElementById('usernameDisplay').textContent = data.username;
  }
}

function getCustomerId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('customerId');
}

async function loadCustomer() {
  customerId = getCustomerId();
  if (!customerId) {
    window.location.href = '/customers.html';
    return;
  }

  try {
    const response = await fetch(`/api/customers/${customerId}`);
    customer = await response.json();
    
    document.getElementById('customerName').textContent = customer.name;
    document.getElementById('customerDetails').innerHTML = `
      ${customer.address ? `<div>📍 ${customer.address}</div>` : ''}
      ${customer.phone ? `<div>📞 ${customer.phone}</div>` : ''}
      ${customer.email ? `<div>✉️ ${customer.email}</div>` : ''}
      ${customer.gstin ? `<div>🏢 GSTIN: ${customer.gstin}</div>` : ''}
    `;
  } catch (error) {
    console.error('Error loading customer:', error);
  }
}

async function loadInvoices() {
  try {
    const response = await fetch(`/api/customers/${customerId}/invoices`);
    const invoices = await response.json();
    
    const tbody = document.getElementById('invoicesBody');
    
    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-invoices">No invoices found. Create your first invoice!</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(invoice => {
      const totalAmount = parseFloat(invoice.total_amount) || 0;
      return `
      <tr>
        <td onclick="viewInvoice(${invoice.id})" style="cursor:pointer;">${invoice.invoice_number}</td>
        <td onclick="viewInvoice(${invoice.id})" style="cursor:pointer;">${formatDate(invoice.invoice_date)}</td>
        <td onclick="viewInvoice(${invoice.id})" style="cursor:pointer;" class="amount">₹${totalAmount.toFixed(2)}</td>
        <td onclick="viewInvoice(${invoice.id})" style="cursor:pointer;">${formatDateTime(invoice.created_at)}</td>
        <td><button onclick="deleteInvoice(${invoice.id}, '${invoice.invoice_number}')" style="background:#dc3545;color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;">Delete</button></td>
      </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN');
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN');
}

function createNewInvoice() {
  window.location.href = `/invoice.html?customerId=${customerId}`;
}

function viewInvoice(invoiceId) {
  window.location.href = `/invoice.html?invoiceId=${invoiceId}`;
}

async function deleteInvoice(invoiceId, invoiceNumber) {
  if (!confirm(`Are you sure you want to delete invoice "${invoiceNumber}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Invoice deleted successfully!');
      loadInvoices();
    } else {
      alert('Error deleting invoice');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error deleting invoice');
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// Initialize
checkAuth();
loadCustomer();
loadInvoices();
