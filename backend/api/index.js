const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// লোকাল এবং ভার্সেল সার্ভারলেস দুই জায়গার জন্যই নিখুঁতভাবে .env ফাইলের পাথ চিনিয়ে দেওয়া
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Database connection state cache for serverless environment
let cachedDb = null;

async function connectDB() {
  // যদি অলরেডি কানেক্টেড থাকে এবং কানেকশন সচল থাকে, তবে আগেরটাই রিটার্ন করবে
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  
  // ভার্সেল ড্যাশবোর্ড বা .env থেকে MONGODB_URI নেওয়া
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  // Serverless Environment-এ কানেকশন ড্রপ হওয়া বন্ধ করার জন্য বেস্ট অপশনস
  const options = {
    bufferCommands: false,         // কানেকশন না থাকলে কুয়েরি বাফার করা বন্ধ রাখবে
    serverSelectionTimeoutMS: 5000, // ৫ সেকেন্ডের মধ্যে কানেক্ট না হলে টাইমআউট দিবে
    socketTimeoutMS: 45000,         // ৪৫ সেকেন্ড পর্যন্ত সকেট কানেকশন সচল রাখবে
  };

  try {
    const db = await mongoose.connect(uri, options);
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('Initial MongoDB connection failed:', error);
    throw error;
  }
}

// Ensure database connection middleware
app.use(async (req, res, next) => {
  // Skip connection for health-checks
  if (req.path === '/api/health') {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error middleware:', err);
    // লাইভে কানেকশন ফেইল করলে ফ্রন্টএন্ডকে ক্র্যাশ করতে না দিয়ে অফলাইন হ্যান্ডলিং সচল রাখা
    next();
  }
});

// Define Mongoose Schema for Commission Records
const CommissionRecordSchema = new mongoose.Schema({
  repName: { type: String, required: true },
  period: { type: String, required: true }, // e.g. "May 2026"
  totalCollection: { type: Number, required: true },
  collectionRate: { type: Number, required: true },
  collectionCommission: { type: Number, required: true },
  collectionBonus: { type: Number, required: true },
  servicePayments: { type: [Number], default: [] }, // Array of transaction amounts
  serviceCommission: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// মঙ্গোডিবি যেন অলরেডি রেজিস্টার্ড মডেল নিয়ে এরর না দেয় (Serverless Safe Re-use)
const CommissionRecord = mongoose.models.CommissionRecord || mongoose.model('CommissionRecord', CommissionRecordSchema);

// Calculation Helpers
function calculateCollectionCommission(collection) {
  let rate = 0;
  let bonus = 0;

  if (collection >= 115000 && collection < 150000) {
    rate = 1.75;
    bonus = 750;
  } else if (collection >= 150000 && collection < 200000) {
    rate = 2.00;
    bonus = 1000;
  } else if (collection >= 200000 && collection < 300000) {
    rate = 2.25;
    bonus = 1250;
  } else if (collection >= 300000 && collection < 400000) {
    rate = 2.50;
    bonus = 1500;
  } else if (collection >= 400000 && collection < 500000) {
    rate = 2.75;
    bonus = 1750;
  } else if (collection >= 500000 && collection < 700000) {
    rate = 3.00;
    bonus = 2000;
  } else if (collection >= 700000) {
    rate = 3.25;
    bonus = 2500;
  }

  const commission = (collection * rate) / 100;
  return { rate, commission, bonus };
}

// Helper calculation for service payments
function calculateServiceCommission(payments) {
  let totalServiceComm = 0;
  
  if (!payments || !Array.isArray(payments)) {
    return 0;
  }

  payments.forEach(val => {
    if (val > 1000 && val <= 3000) {
      totalServiceComm += 150;
    } else if (val > 3000 && val <= 6000) {
      totalServiceComm += 300;
    } else if (val > 6000 && val <= 15000) {
      totalServiceComm += 400;
    } else if (val > 15000) {
      totalServiceComm += 500;
    }
  });

  return totalServiceComm;
}

// API Routes

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 2. Get all calculation records
app.get('/api/records', async (req, res) => {
  try {
    const records = await CommissionRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to retrieve records', message: err.message });
  }
});

// 3. Save a new commission record
app.post('/api/records', async (req, res) => {
  try {
    const { repName, period, totalCollection, servicePayments } = req.body;

    if (!repName || !period || totalCollection === undefined) {
      return res.status(400).json({ error: 'Validation failed: repName, period, and totalCollection are required.' });
    }

    const parsedCollection = parseFloat(totalCollection) || 0;
    const parsedPayments = Array.isArray(servicePayments) 
      ? servicePayments.map(p => parseFloat(p) || 0).filter(p => p > 0)
      : [];

    // Perform server-side calculations
    const collResult = calculateCollectionCommission(parsedCollection);
    const serviceComm = calculateServiceCommission(parsedPayments);
    const grandTotal = collResult.commission + collResult.bonus + serviceComm;

    const newRecord = new CommissionRecord({
      repName,
      period,
      totalCollection: parsedCollection,
      collectionRate: collResult.rate,
      collectionCommission: collResult.commission,
      collectionBonus: collResult.bonus,
      servicePayments: parsedPayments,
      serviceCommission: serviceComm,
      grandTotal
    });

    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (err) {
    console.error('Error saving record:', err);
    res.status(500).json({ error: 'Failed to save record', message: err.message });
  }
});

// 4. Delete a commission record
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CommissionRecord.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ message: 'Record deleted successfully', id });
  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ error: 'Failed to delete record', message: err.message });
  }
});

// Serve static frontend files if running locally
app.use(express.static(path.join(__dirname, '../../frontend')));

// Global 404 Handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Catch-all route to serve index.html for frontend routing (if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Export app for local server and Vercel serverless functions
module.exports = app;