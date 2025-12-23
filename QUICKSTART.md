# Quick Start Guide

## Installation (3 Simple Steps)

### 1. Install Dependencies
```bash
npm run install-all
```

### 2. Seed Sample Data
```bash
cd server
npm run seed
```

### 3. Start the Application
```bash
cd ..
npm run dev
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Sample Login Credentials

Use these credentials to access the restaurant dashboard:

| Restaurant | Email | Password |
|------------|-------|----------|
| Spice Garden | spice@example.com | password123 |
| Pizza Paradise | pizza@example.com | password123 |
| Burger Hub | burger@example.com | password123 |

## Quick Tour

### Customer Experience
1. Visit http://localhost:3000
2. Search for restaurants or browse all
3. Click on any restaurant to view menu
4. Add items to cart
5. Click cart icon → Checkout
6. Fill delivery details and place order

### Restaurant Dashboard
1. Visit http://localhost:3000/restaurant-login
2. Login with any credentials above
3. View live orders in real-time
4. Manage menu items (add/edit/delete)
5. Update order status
6. View QR codes for tables

### QR Table Ordering
1. Visit: http://localhost:3000/qr/[restaurantId]/[tableNumber]
2. Or click QR code links in restaurant dashboard
3. Browse menu and order directly to kitchen

## Data Storage

All data is stored locally in `server/data/` as JSON files:
- `restaurants.json` - Restaurant and menu data
- `orders.json` - Order history

No database installation required!

## Troubleshooting

**Port already in use?**
- Change ports in `client/vite.config.js` (frontend) and `server/server.js` (backend)

**Can't see sample data?**
- Make sure you ran `npm run seed` from the server directory

**Real-time orders not working?**
- Check that both frontend and backend are running
- Socket.IO connects automatically

## Features to Try

✅ Search restaurants by name or cuisine
✅ Filter by delivery availability
✅ Add multiple items to cart
✅ Place delivery or dine-in orders
✅ Scan QR codes for table ordering
✅ Manage restaurant menu
✅ Track order status in real-time
✅ Mock payment with UPI/Card

Enjoy exploring WaitNot! 🍔🍕🍜
