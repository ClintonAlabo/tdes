// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const bcrypt = require('bcryptjs');
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
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- DB ----------
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
global.db = pool;

// ---------- JWT ----------
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ---------- Controllers ----------
const userCtrl = require('./controllers/userController');
const jobCtrl = require('./controllers/jobController');
const companyCtrl = require('./controllers/companyController');
const adminCtrl = require('./controllers/adminController');

// ---------- Auth Middleware ----------
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ msg: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
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

app.get('/api/search', companyCtrl.searchCandidates);

app.get('/api/admin/stats', authenticate, adminCtrl.getStats);
app.put('/api/admin/role/:userId', authenticate, adminCtrl.updateRole);

// FALLBACK: Serve index.html for SPA routes (ONLY after static + API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Start ----------
app.listen(PORT, () => console.log(`Server running on ${PORT}`));