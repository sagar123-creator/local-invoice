let customers = [];

async function checkAuth() {
  const response = await fetch('/api/auth/check');
  const data = await response.json();
  if (!data.authenticated) {
    window.location.href = '/login.html';
  } else {
    document.getElementById('usernameDisplay').textContent = data.username;
  }
}

async function loadCustomers() {
  try {
    const response = await fetch('/api/customers');
    customers = await response.json();
    
    // Fetch balance for each customer
    for (let customer of customers) {
      try {
        const balanceResponse = await fetch(`/api/customers/${customer._id}/latest-balance`);
        const balanceData = await balanceResponse.json();
       customer.balance = parseFloat(balanceData.balance) || 0;
      } catch (error) {
        customer.balance = 0;
      }
    }
    
    displayCustomers(customers);
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

function displayCustomers(customersToDisplay) {
  const grid = document.getElementById('customersGrid');
  
  if (customersToDisplay.length === 0) {
    grid.innerHTML = '<div class="no-customers">No customers found. Add your first customer!</div>';
    return;
  }

  grid.innerHTML = customersToDisplay.map(customer => {
    
    const balance = parseFloat(customer.balance) || 0;

    const balanceClass = balance > 0 ? 'negative' : (balance === 0 ? 'zero' : '');
    return `
    <div class="customer-card">
      <button class="btn-delete-customer" onclick="event.stopPropagation(); deleteCustomer('${customer._id}', '${customer.name.replace(/'/g, "\\'")}')">Delete</button>
      <div onclick="viewCustomer('${customer._id}')" style="cursor:pointer;">
        <div class="customer-name">${customer.name}</div>
        <div class="customer-info">
          ${customer.address ? `<p>📍 ${customer.address}</p>` : ''}
          ${customer.phone ? `<p>📞 ${customer.phone}</p>` : ''}
          ${customer.email ? `<p>✉️ ${customer.email}</p>` : ''}
          ${customer.gstin ? `<p>🏢 GSTIN: ${customer.gstin}</p>` : ''}
        </div>
        <div class="customer-balance ${balanceClass}">
          Balance: ₹${balance.toFixed(2)}
        </div>
      </div>
    </div>
    `;
  }).join('');
}

function filterCustomers() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filtered = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm) ||
    (customer.address && customer.address.toLowerCase().includes(searchTerm)) ||
    (customer.phone && customer.phone.includes(searchTerm)) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm))
  );
  displayCustomers(filtered);
}

function openAddCustomerModal() {
  document.getElementById('customerModal').classList.add('active');
  document.getElementById('customerForm').reset();
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('active');
}

document.getElementById('customerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const customerData = {
    name: document.getElementById('customerName').value,
    address: document.getElementById('customerAddress').value,
    phone: document.getElementById('customerPhone').value,
    email: document.getElementById('customerEmail').value,
    gstin: document.getElementById('customerGSTIN').value
  };

  try {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    if (response.ok) {
      closeCustomerModal();
      loadCustomers();
    }
  } catch (error) {
    console.error('Error adding customer:', error);
    alert('Error adding customer. Please try again.');
  }
});

function viewCustomer(customerId) {
  window.location.href = `/customer-invoices.html?customerId=${customerId}`;
}

async function deleteCustomer(customerId, customerName) {
  if (!confirm(`Are you sure you want to delete customer "${customerName}"? This will also delete all their invoices. This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      alert('Customer deleted successfully!');
      loadCustomers();
    } else {
      alert('Error deleting customer');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error deleting customer');
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// Initialize
checkAuth();
loadCustomers();
