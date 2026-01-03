let customerId = null;
let customer = null;

async function checkAuth() {
  const response = await fetch('/api/auth/check');
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = '/login.html';
  }
}

function getCustomerId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('customerId');
}

async function loadCustomerInfo() {
  customerId = getCustomerId();
  if (!customerId) {
    window.location.href = '/customers.html';
    return;
  }

  try {
    const response = await fetch(`/api/customers/${customerId}`);
    customer = await response.json();
    
    // Set default date range (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('fromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('toDate').value = today.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error loading customer:', error);
    alert('Error loading customer information');
  }
}

async function loadStatement() {
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;

  if (!fromDate || !toDate) {
    alert('Please select both from and to dates');
    return;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    alert('From date cannot be after to date');
    return;
  }

  try {
    // Fetch statement data
    const response = await fetch(`/api/customers/${customerId}/statement?fromDate=${fromDate}&toDate=${toDate}`);
    const data = await response.json();

    // Populate customer info
    document.getElementById('customerName').textContent = data.customer.name;
    document.getElementById('customerAddress').textContent = data.customer.address ? `📍 ${data.customer.address}` : '';
    document.getElementById('customerPhone').textContent = data.customer.phone ? `📞 ${data.customer.phone}` : '';
    document.getElementById('customerGstin').textContent = data.customer.gstin ? `🏢 GSTIN: ${data.customer.gstin}` : '';

    // Display period
    document.getElementById('periodDisplay').textContent = `${formatDate(fromDate)} to ${formatDate(toDate)}`;

    // Build statement table
    const tbody = document.getElementById('statementBody');
    
    if (data.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No invoices found for the selected period</td></tr>';
      document.getElementById('finalBalance').textContent = `₹${(data.openingBalance || 0).toFixed(2)}`;
    } else {
      let html = '';
      let runningBalance = data.openingBalance || 0;

      // Show opening balance if exists
      if (data.openingBalance && data.openingBalance !== 0) {
        html += `
          <tr class="opening-balance-row">
            <td class="col-date"></td>
            <td class="col-invoice"></td>
            <td class="col-particulars"><strong>Opening Balance (B/F)</strong></td>
            <td class="col-amount"></td>
            <td class="col-received"></td>
            <td class="col-balance">${runningBalance.toFixed(2)}</td>
          </tr>
        `;
      }

      // Add each invoice with its items
      data.invoices.forEach(invoice => {
        const totalAmount = parseFloat(invoice.totalAmount) || 0;
        const receivedAmount = parseFloat(invoice.receivedAmount) || 0;
        runningBalance = runningBalance + totalAmount - receivedAmount;

        html += `
          <tr class="invoice-row">
            <td class="col-date">${formatDate(invoice.invoiceDate)}</td>
            <td class="col-invoice">${invoice.invoiceNumber}</td>
            <td class="col-particulars"><strong>Invoice</strong></td>
            <td class="col-amount">${totalAmount.toFixed(2)}</td>
            <td class="col-received">${receivedAmount > 0 ? receivedAmount.toFixed(2) : '—'}</td>
            <td class="col-balance">${runningBalance.toFixed(2)}</td>
          </tr>
        `;

        // Add item details rows
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach(item => {
            const qty = parseFloat(item.quantity);
            const qtyDisplay = qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(3);
            html += `
              <tr class="item-row">
                <td class="col-date"></td>
                <td class="col-invoice"></td>
                <td class="col-particulars">↳ ${item.particular} <span style="color:#888;">(${qtyDisplay} × ₹${parseFloat(item.rate).toFixed(2)})</span></td>
                <td class="col-amount">${parseFloat(item.amount).toFixed(2)}</td>
                <td class="col-received"></td>
                <td class="col-balance"></td>
              </tr>
            `;
          });
        }
      });

      // Add total row
      const totalInvoiceAmount = data.invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
      const totalReceived = data.invoices.reduce((sum, inv) => sum + (parseFloat(inv.receivedAmount) || 0), 0);

      html += `
        <tr class="total-row">
          <td class="col-date"></td>
          <td class="col-invoice"></td>
          <td class="col-particulars" style="text-align:right;padding-right:15px;"><strong>TOTAL</strong></td>
          <td class="col-amount"><strong>${totalInvoiceAmount.toFixed(2)}</strong></td>
          <td class="col-received"><strong>${totalReceived.toFixed(2)}</strong></td>
          <td class="col-balance"><strong>${runningBalance.toFixed(2)}</strong></td>
        </tr>
      `;

      tbody.innerHTML = html;
      document.getElementById('finalBalance').textContent = `₹${runningBalance.toFixed(2)}`;
    }

    // Show statement and controls
    document.getElementById('statementPage').classList.add('visible');
    document.getElementById('controls').style.display = 'flex';
    
    // Scroll to statement
    document.getElementById('statementPage').scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Error loading statement:', error);
    alert('Error generating statement');
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN');
}

function goBack() {
  window.location.href = `/customer-invoices.html?customerId=${customerId}`;
}

// Initialize
checkAuth();
loadCustomerInfo();
