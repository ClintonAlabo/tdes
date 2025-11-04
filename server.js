// server.js
require('dotenv').config(); // ← MUST BE FIRST

const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SERVE STATIC FILES FIRST (CRITICAL)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer ----------
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Database ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
global.db = pool;

// ---------- JWT ----------
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-never-use-in-production';

// ---------- Controllers ----------
const userCtrl    = require('./controllers/userController');
const jobCtrl     = require('./controllers/jobController');
const companyCtrl = require('./controllers/companyController');
const adminCtrl   = require('./controllers/adminController');

// DEBUG: Check ALL handlers
console.log('Controllers loaded:');
console.log('  userCtrl.register:', typeof userCtrl.register);
console.log('  companyCtrl.searchCandidates:', typeof companyCtrl.searchCandidates);
console.log('  adminCtrl.getStats:', typeof adminCtrl.getStats);
console.log('  adminCtrl.updateRole:', typeof adminCtrl.updateRole);

// ---------- Auth Middleware ----------
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return res.status(401).json({ msg: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

// ---------- API Routes ----------
app.post('/api/register', upload.array('documents'), userCtrl.register);
app.post('/api/login', userCtrl.login);

app.get('/api/profile', authenticate, userCtrl.getProfile);
app.put('/api/profile', authenticate, upload.array('documents'), userCtrl.updateProfile);

app.post('/api/jobs', authenticate, jobCtrl.createJob);
app.get('/api/jobs', jobCtrl.getJobs);
app.get('/api/jobs/:id', jobCtrl.getJob);
app.put('/api/jobs/:id', authenticate, jobCtrl.updateJob);
app.delete('/api/jobs/:id', authenticate, jobCtrl.deleteJob);

app.post('/api/apply/:jobId', authenticate, userCtrl.applyJob);
app.get('/api/applications', authenticate, userCtrl.getApplications);

app.get('/api/search', authenticate, companyCtrl.searchCandidates);

app.get('/api/admin/stats', authenticate, adminCtrl.getStats);
app.put('/api/admin/role/:userId', authenticate, adminCtrl.updateRole);

// ---------- Fallback for SPA (after API) ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Error Handler (Optional) ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ msg: 'Server error' });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Visit: http://localhost:${PORT}/index.html`);
});