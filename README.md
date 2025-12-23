# 🍽️ WaitNot - Smart Restaurant Ordering System

A complete restaurant management and ordering system with real-time features, QR code ordering, and comprehensive analytics.

## ✨ Features

### 🏪 Restaurant Management
- **Multi-restaurant support** with individual dashboards
- **Menu management** with categories, pricing, and availability
- **Table management** with QR code generation
- **Order tracking** with real-time status updates
- **Dual printer system** (Kitchen + Cash Counter)

### 📱 Customer Experience
- **QR code ordering** - Scan table QR to order
- **Multiple order types** - Dine-in, Delivery, Takeaway
- **Real-time order updates** via WebSocket
- **Multiple payment options** - UPI, Card, Cash
- **Multi-language support** with translation

### 📊 Analytics & Reports
- **Comprehensive dashboard** with business insights
- **Revenue tracking** with daily, weekly, monthly views
- **Popular items analysis** and customer behavior
- **Downloadable reports** in CSV format
- **Real-time metrics** and performance indicators

### 🖨️ Printing System
- **Smart kitchen printing** - Only unprinted items show print button
- **Separate receipt printing** for cash counter
- **Configurable printer settings** per restaurant
- **Professional POS-style receipts**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/waitnot/Waitnot.git
cd Waitnot
```

2. **Install dependencies**
```bash
npm run install-all
```

3. **Seed sample data**
```bash
cd server
npm run seed
```

4. **Start development servers**
```bash
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Sample Login Credentials
- **Email**: spice@example.com | **Password**: password123
- **Email**: pizza@example.com | **Password**: password123
- **Email**: burger@example.com | **Password**: password123

## 🏗️ Architecture

### Frontend (React + Vite)
- **React 18** with modern hooks
- **Tailwind CSS** for styling
- **Recharts** for analytics visualization
- **Socket.IO Client** for real-time updates
- **Axios** for API communication

### Backend (Node.js + Express)
- **Express.js** REST API
- **Socket.IO** for real-time features
- **JSON file database** (production-ready)
- **bcrypt** for password hashing
- **JWT** for authentication

## 📁 Project Structure

```
Waitnot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── data/             # JSON database
│   └── models/           # Data models
└── docs/                 # Documentation
```

## 🚀 Deployment

### Option 1: Render (Recommended)
1. Push code to GitHub
2. Connect repository to Render
3. Set build command: `npm run render-build`
4. Set start command: `npm start`
5. Deploy!

### Option 2: Railway
1. Connect GitHub repository
2. Railway auto-detects Node.js
3. Set environment variables
4. Deploy automatically

### Environment Variables
```
NODE_ENV=production
PORT=10000
```

## 📊 Database

Currently uses **JSON file storage** for simplicity:
- `server/data/restaurants.json` - Restaurant data & menus
- `server/data/orders.json` - Order history & transactions

**Migration to PostgreSQL/MongoDB available** for scaling.

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Restaurant login
- `POST /api/auth/register` - Restaurant registration

### Restaurants
- `GET /api/restaurants` - Get all restaurants
- `GET /api/restaurants/:id` - Get restaurant details
- `PUT /api/restaurants/:id` - Update restaurant
- `POST /api/restaurants/:id/menu` - Add menu item

### Orders
- `GET /api/orders/restaurant/:id` - Get restaurant orders
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status

### Analytics
- `GET /api/analytics/restaurant/:id` - Get analytics data
- `GET /api/analytics/restaurant/:id/report` - Download reports

## 🎯 Features in Detail

### QR Code Ordering
- Each table gets a unique QR code
- Customers scan → Order directly
- Real-time order updates to restaurant
- No app installation required

### Dual Printer System
- **Kitchen Printer**: Prints order details for cooking
- **Cash Counter**: Prints final receipt for customer
- Smart button visibility (disappears after printing)

### Multi-language Support
- English, Hindi, Arabic, Spanish, French
- Google Translate API integration
- Automatic language detection

### Real-time Features
- Live order notifications
- Status updates via WebSocket
- Instant menu updates
- Real-time analytics

## 🛠️ Development

### Adding New Features
1. Create feature branch: `git checkout -b feature/new-feature`
2. Develop and test locally
3. Update documentation
4. Submit pull request

### Testing
- Manual testing guide in `TESTING.md`
- API testing with Postman/curl
- Real device testing for QR codes

## 📈 Scaling

### Performance Optimization
- Implement Redis for caching
- Add database indexing
- Use CDN for static assets
- Implement rate limiting

### Multi-tenant Support
- Separate database per restaurant
- Subdomain routing
- Centralized admin panel

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: Check `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@waitnot.com

## 🎉 Success Stories

Perfect for:
- ✅ Small to medium restaurants
- ✅ Food courts and cafes  
- ✅ Quick service restaurants
- ✅ Cloud kitchens
- ✅ Multi-location chains

---

**Built with ❤️ for the restaurant industry**

*Helping restaurants serve better, faster, and smarter.*