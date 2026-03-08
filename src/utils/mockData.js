// src/utils/mockData.js

export const DEMO_RIDER = {
  uid: "R001", // Matches rider ID in Admin Panel so assignments flow through
  name: "Visal Sok",
  email: "rider@test.com",
  password: "test123",
  phone: "017 111 222",
  vehicle: "Honda PCX 150",
  plate: "PP-1234",
  avatar: "V",
  approved: true,
  rating: 4.9,
  totalDeliveries: 127,
  earnings: { today: 18.5, week: 84.0, total: 420.0 },
};

export const MOCK_INCOMING_ORDERS = [
  {
    id: "ORD-2001",
    shopName: "Burger Palace", shopEmoji: "🍔", shopAddress: "St. 63, Phnom Penh",
    customerName: "Sophea Meas", customerPhone: "012 345 678",
    deliveryAddress: "St. 271, Phnom Penh",
    items: [{ name: "Classic Beef Burger", qty: 2 }, { name: "French Fries", qty: 1 }],
    distance: "1.8 km", estimatedTime: "12 min",
    deliveryFee: 2.5, total: 21.0,
    status: "confirmed", assignedAt: null,
  },
  {
    id: "ORD-2002",
    shopName: "Noodle House", shopEmoji: "🍜", shopAddress: "St. 51, Phnom Penh",
    customerName: "Dara Chan", customerPhone: "012 987 654",
    deliveryAddress: "Toul Kork, Phnom Penh",
    items: [{ name: "Pad Thai", qty: 1 }, { name: "Spring Rolls", qty: 1 }],
    distance: "2.3 km", estimatedTime: "15 min",
    deliveryFee: 3.0, total: 14.0,
    status: "confirmed", assignedAt: null,
  },
];

export const MOCK_ACTIVE_ORDER = {
  id: "ORD-1998",
  shopName: "Pizza Corner", shopEmoji: "🍕", shopAddress: "St. 93, Phnom Penh",
  customerName: "Ratanak Lim", customerPhone: "017 555 666",
  deliveryAddress: "BKK1, Phnom Penh",
  items: [{ name: "Margherita Pizza", qty: 1 }, { name: "Garlic Bread", qty: 1 }],
  distance: "1.5 km", estimatedTime: "8 min",
  deliveryFee: 2.0, total: 15.0,
  status: "delivering", assignedAt: "2:00 PM",
};

export const MOCK_HISTORY = [
  { id: "ORD-1990", shopName: "Burger Palace", shopEmoji: "🍔", customerName: "Sophea Meas", deliveryFee: 2.5, date: "Feb 28, 2026", time: "10:30 AM", status: "delivered" },
  { id: "ORD-1985", shopName: "Noodle House",  shopEmoji: "🍜", customerName: "Dara Chan",   deliveryFee: 3.0, date: "Feb 27, 2026", time: "12:15 PM", status: "delivered" },
  { id: "ORD-1980", shopName: "BBQ Garden",    shopEmoji: "🍗", customerName: "Kosal Pich",  deliveryFee: 2.0, date: "Feb 27, 2026", time: "6:45 PM",  status: "delivered" },
  { id: "ORD-1975", shopName: "Fresh Salads",  shopEmoji: "🥗", customerName: "Srey Mom",    deliveryFee: 1.5, date: "Feb 26, 2026", time: "1:30 PM",  status: "delivered" },
];