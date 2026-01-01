# Invoice Management System

A complete invoice management system for Sandhya Sea Food Supplier with authentication, customer management, and database integration.

## Features

- **User Authentication**: Secure login system
- **Customer Management**: Add and manage customer details
- **Invoice Creation**: Create and manage invoices for each customer
- **Database Storage**: All data stored in SQLite database
- **Print/PDF**: Generate printable invoices

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Default Login Credentials

- Username: `admin`
- Password: `admin123`

## Usage Flow

1. **Login** - Access the system with credentials
2. **Customers Page** - View all customers, add new customers
3. **Customer Invoices** - Click on a customer to view their invoices
4. **Create Invoice** - Click "Create Invoice" to generate a new invoice
5. **Save & Print** - Save the invoice and print/export as PDF

## Project Structure

```
local-invoice/
├── server.js           # Express server
├── database.js         # Database operations
├── package.json        # Dependencies
├── public/             # Frontend files
│   ├── login.html      # Login page
│   ├── customers.html  # Customer listing
│   ├── customer-invoices.html  # Customer's invoices
│   └── invoice.html    # Invoice creation/editing
└── image/              # Logo and images
```

## Technologies Used

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcryptjs, express-session
- **Frontend**: HTML, CSS, JavaScript

## Development

For development with auto-restart:
```bash
npm run dev
```

## Notes

- All invoices are linked to customers
- Session expires after 24 hours
- Database file is automatically created on first run
- Images should be placed in the `image/` folder
