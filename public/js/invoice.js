const itemsBody = document.getElementById("itemsBody");
const totalAmountDisplay = document.getElementById("totalAmountDisplay");
const totalInWords = document.getElementById("totalInWords");
let customerId = null;
let invoiceId = null;
let isEditMode = false;

async function checkAuth() {
  const response = await fetch('/api/auth/check');
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = '/login.html';
  }
}

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  customerId = urlParams.get('customerId');
  invoiceId = urlParams.get('invoiceId');
  isEditMode = !!invoiceId;
}

async function loadCustomerData() {
  if (!customerId && !invoiceId) {
    alert('No customer or invoice selected');
    window.location.href = '/customers.html';
    return;
  }

  try {
    if (invoiceId) {
      // Load existing invoice
      const response = await fetch(`/api/invoices/${invoiceId}`);
      const invoice = await response.json();
      
      customerId = invoice.customer_id;
      document.getElementById('customerName').value = invoice.customer_name;
      document.getElementById('shippingAddress').value = invoice.address || '';
      document.getElementById('invoiceNo').value = invoice.invoice_number;
      document.getElementById('billDate').value = invoice.invoice_date;
      document.getElementById('receivedAmount').value = (invoice.received_amount || 0).toFixed(2);
      document.getElementById('previousBalance').value = (invoice.previous_balance || 0).toFixed(2);
      
      // Get row count from localStorage or use items count with minimum of 5
      const savedRowCount = localStorage.getItem(`invoice_${invoiceId}_rowCount`);
      const rowCount = savedRowCount ? parseInt(savedRowCount) : Math.max(invoice.items.length, 5);
      
      // Load invoice items
      for (let i = 0; i < rowCount; i++) {
        const item = invoice.items[i];
        if (item) {
          addRow(item.particular, item.quantity, item.rate);
        } else {
          addRow();
        }
      }
      
      // Show delete button when editing
      document.getElementById('deleteInvoiceBtn').style.display = 'inline-block';
    } else {
      // Load customer data for new invoice
      const response = await fetch(`/api/customers/${customerId}`);
      const customer = await response.json();
      
      document.getElementById('customerName').value = customer.name;
      document.getElementById('shippingAddress').value = customer.address || '';
      
      // Fetch previous balance from latest invoice
      const balanceResponse = await fetch(`/api/customers/${customerId}/latest-balance`);
      const balanceData = await balanceResponse.json();
      const previousBalance = parseFloat(balanceData.balance) || 0;
      document.getElementById('previousBalance').value = previousBalance.toFixed(2);
      
      // Set today's date
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('billDate').value = today;
      
      // Generate invoice number (you can improve this)
      const invoiceNum = 'INV' + Date.now().toString().slice(-6);
      document.getElementById('invoiceNo').value = invoiceNum;
      
      // Add initial rows
      for (let i = 0; i < 5; i++) addRow();
    }
    
    updateTotals();
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Error loading data');
  }
}

function addRow(particular = "", qty = "", rate = "") {
  const rowIndex = itemsBody.children.length + 1;
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td class="col-sr"></td>
    <td class="col-particular">
      <input type="text" class="particular" value="${particular}">
    </td>
    <td class="col-qty">
      <input type="text" class="qty" value="${qty}">
    </td>
    <td class="col-rate">
      <input type="text" class="rate" value="${rate}">
    </td>
    <td class="col-amount">
      <input type="text" class="amount amount-input" readonly>
    </td>
  `;
  itemsBody.appendChild(tr);

  const particularInput = tr.querySelector(".particular");
  const qtyInput = tr.querySelector(".qty");
  const rateInput = tr.querySelector(".rate");
  
  particularInput.addEventListener("input", () => {
    updateSerialNumbers();
    updateTotals();
  });
  qtyInput.addEventListener("blur", () => {
    // Format qty to 3 decimal places only when leaving the field
    if (qtyInput.value) {
      const value = parseFloat(qtyInput.value);
      if (!isNaN(value)) {
        qtyInput.value = value.toFixed(3);
      }
    }
    updateTotals();
  });
  qtyInput.addEventListener("input", updateTotals);
  rateInput.addEventListener("input", updateTotals);
  
  // Set initial serial number if particular has value
  if (particular) {
    updateSerialNumbers();
  }
}

function deleteLastRow() {
  if (itemsBody.children.length > 0) {
    itemsBody.removeChild(itemsBody.lastElementChild);
    updateSerialNumbers();
    updateTotals();
  }
}

function updateSerialNumbers() {
  let srNo = 1;
  [...itemsBody.children].forEach((tr) => {
    const particular = tr.querySelector('.particular').value.trim();
    if (particular) {
      tr.querySelector('.col-sr').textContent = srNo++;
    } else {
      tr.querySelector('.col-sr').textContent = '';
    }
  });
}

function updateTotals() {
  let total = 0;
  [...itemsBody.children].forEach(tr => {
    const qty = parseFloat(tr.querySelector(".qty").value) || 0;
    const rate = parseFloat(tr.querySelector(".rate").value) || 0;
    const amount = qty * rate;
    tr.querySelector(".amount").value = amount ? amount.toFixed(2) : "";
    total += amount;
  });
  totalAmountDisplay.textContent = total.toFixed(2);
  totalInWords.textContent = numberToWordsIndian(Math.round(total)) + " Only.";
  
  // Calculate current balance
  updateCurrentBalance();
}

function updateCurrentBalance() {
  const total = parseFloat(totalAmountDisplay.textContent) || 0;
  const received = parseFloat(document.getElementById('receivedAmount').value) || 0;
  const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
  const currentBalance = total - received + previousBalance;
  
  document.getElementById('currentBalance').textContent = currentBalance.toFixed(2);
}

function numberToWordsIndian(num) {
  if (num === 0) return "Zero";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function twoDigits(n) {
    if (n < 20) return a[n];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return b[tens] + (ones ? " " + a[ones] : "");
  }

  function threeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = "";
    if (hundred) str += a[hundred] + " Hundred";
    if (rest) str += (hundred ? " " : "") + twoDigits(rest);
    return str;
  }

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += threeDigits(lakh) + " Lakh ";
  if (thousand) result += threeDigits(thousand) + " Thousand ";
  if (hundred) result += threeDigits(hundred);

  return result.trim();
}

async function saveInvoice() {
  const invoiceNumber = document.getElementById('invoiceNo').value;
  const invoiceDate = document.getElementById('billDate').value;
  const receivedAmount = parseFloat(document.getElementById('receivedAmount').value) || 0;
  const previousBalance = parseFloat(document.getElementById('previousBalance').value) || 0;
  
  if (!invoiceNumber || !invoiceDate) {
    alert('Please fill invoice number and date');
    return;
  }

  // Store current row count and all row data
  const currentRowCount = itemsBody.children.length;
  
  // Save row count to localStorage for later retrieval
  if (invoiceId) {
    localStorage.setItem(`invoice_${invoiceId}_rowCount`, currentRowCount);
  }
  
  const rowData = [];
  [...itemsBody.children].forEach(tr => {
    rowData.push({
      particular: tr.querySelector('.particular').value,
      qty: tr.querySelector('.qty').value,
      rate: tr.querySelector('.rate').value
    });
  });

  // Collect items for saving (only non-empty rows)
  const items = [];
  [...itemsBody.children].forEach(tr => {
    const particular = tr.querySelector('.particular').value.trim();
    const qty = parseFloat(tr.querySelector('.qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.rate').value) || 0;
    
    if (particular && qty > 0 && rate > 0) {
      items.push({ particular, quantity: qty, rate });
    }
  });

  if (items.length === 0) {
    alert('Please add at least one item');
    return;
  }

  try {
    let response;
    if (isEditMode) {
      // Update existing invoice
      response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber, invoiceDate, items, receivedAmount, previousBalance })
      });
    } else {
      // Create new invoice
      response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, invoiceNumber, invoiceDate, items, receivedAmount, previousBalance })
      });
    }

    if (response.ok) {
      const savedInvoice = await response.json();
      alert('Invoice saved successfully!');
      
      // Update to edit mode with the saved invoice ID
      if (!isEditMode) {
        invoiceId = savedInvoice.id;
        isEditMode = true;
        // Save row count for this new invoice
        localStorage.setItem(`invoice_${invoiceId}_rowCount`, currentRowCount);
        // Update URL without reloading
        window.history.replaceState({}, '', `/invoice.html?invoiceId=${invoiceId}`);
        // Show delete button
        document.getElementById('deleteInvoiceBtn').style.display = 'inline-block';
      }
      
      // Restore all rows with same count
      itemsBody.innerHTML = '';
      rowData.forEach(row => {
        addRow(row.particular, row.qty, row.rate);
      });
      updateTotals();
    } else {
      alert('Error saving invoice');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error saving invoice');
  }
}

async function deleteInvoice() {
  if (!invoiceId) return;
  
  if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Invoice deleted successfully!');
      window.location.href = `/customer-invoices.html?customerId=${customerId}`;
    } else {
      alert('Error deleting invoice');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error deleting invoice');
  }
}

function goBack() {
  if (customerId) {
    window.location.href = `/customer-invoices.html?customerId=${customerId}`;
  } else {
    window.location.href = '/customers.html';
  }
}

// Initialize
checkAuth();
getUrlParams();
loadCustomerData();

// Add event listeners for balance calculation
document.getElementById('receivedAmount').addEventListener('input', updateCurrentBalance);
document.getElementById('previousBalance').addEventListener('input', updateCurrentBalance);
