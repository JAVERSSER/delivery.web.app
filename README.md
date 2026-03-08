# 🛵 FoodDash — Rider / Delivery App

Mobile-first delivery partner web app. Runs without Firebase (Demo Mode).

## 🚀 Quick Start
```bash
npm install
npm run dev
```
Open **http://localhost:5173** — or load in React Native WebView.

## 🔐 Test Account
| Email | Password |
|-------|----------|
| rider@test.com | test123 |

## 📱 Features
- Online / Offline toggle
- Receive incoming order requests
- View order details (pickup + delivery route)
- Accept or decline orders
- Step-by-step delivery flow (Arrived → Picked Up → Delivered)
- Call customer directly
- Earnings dashboard
- Delivery history
- Rider profile

## 🔥 Connect Firebase
1. Fill in `src/services/firebase.js`
2. Set `DEMO_MODE = false` in `src/context/AuthContext.jsx`
3. Add Firestore real-time listeners for live orders

## 📁 Structure
```
src/
├── context/AuthContext.jsx   ← Rider auth + Demo login
├── components/UI.jsx         ← Button, BottomSheet, Toast...
├── components/BottomNav.jsx  ← Bottom navigation
├── pages/AuthPage.jsx        ← Login
├── pages/HomePage.jsx        ← Dashboard + Active order + Incoming orders
├── pages/HistoryPage.jsx     ← Delivery history + earnings
├── pages/ProfilePage.jsx     ← Profile + vehicle info
├── utils/mockData.js         ← Demo data
└── services/firebase.js      ← Firebase config (fill when ready)
```