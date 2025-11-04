// controllers/userController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const register = async (req, res) => {
  const {
    name, email, password, age, education, specialization,
    occupation, skills, talents, employmentHistory
  } = req.body;

  const hashed = await bcrypt.hash(password, 10);
  const client = await global.db.connect();

  try {
    const result = await client.query(
      `INSERT INTO users (name,email,password,age,education,specialization,
        occupation,skills,talents,employment_history,role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'member') RETURNING id`,
      [name, email, hashed, age, education, specialization,
        occupation, skills, talents, employmentHistory]
    );

    const docs = [];
    if (req.files) {
      for (const f of req.files) {
        const b64 = Buffer.from(f.buffer).toString('base64');
        const dataURI = `data:${f.mimetype};base64,${b64}`;
        const up = await cloudinary.uploader.upload(dataURI, { resource_type: 'auto' });
        docs.push(up.secure_url);
      }
    }

    await client.query(
      `UPDATE users SET documents=$1 WHERE id=$2`,
      [JSON.stringify(docs), result.rows[0].id]
    );

    res.json({ msg: 'Registered successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Registration failed' });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const client = await global.db.connect();

  try {
    const { rows } = await client.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows[0]) return res.status(400).json({ msg: 'User not found' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Wrong password' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: user.role, name: user.name });
  } catch (e) {
    res.status(500).json({ msg: 'Login error' });
  } finally {
    client.release();
  }
};

const getProfile = async (req, res) => {
  const client = await global.db.connect();
  try {
    const { rows } = await client.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    user.documents = user.documents ? JSON.parse(user.documents) : [];
    res.json(user);
  } catch (e) {
    res.status(500).json({ msg: 'Profile fetch failed' });
  } finally {
    client.release();
  }
};

const updateProfile = async (req, res) => {
  const updates = { ...req.body };
  delete updates.password; // Prevent password change here

  const client = await global.db.connect();

  try {
    // === 1. Get current documents ===
    const existingResult = await client.query('SELECT documents FROM users WHERE id=$1', [req.user.id]);
    let docs = existingResult.rows[0].documents ? JSON.parse(existingResult.rows[0].documents) : [];

    // === 2. Preserve old documents if sent from frontend ===
    if (updates.existingDocs) {
      try {
        const preserved = JSON.parse(updates.existingDocs);
        if (Array.isArray(preserved)) {
          docs = preserved; // Replace with frontend-preserved list
        }
      } catch (e) {
        console.warn('Invalid existingDocs JSON');
      }
      delete updates.existingDocs; // Remove from text updates
    }

    // === 3. Upload new files (if any) ===
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const b64 = Buffer.from(f.buffer).toString('base64');
        const dataURI = `data:${f.mimetype};base64,${b64}`;
        const up = await cloudinary.uploader.upload(dataURI, { resource_type: 'auto' });
        docs.push(up.secure_url);
      }
    }

    // === 4. Update text fields (if any) ===
    const textFields = Object.keys(updates);
    if (textFields.length > 0) {
      const setClause = textFields.map((key, i) => `${key}=$${i + 2}`).join(', ');
      const values = textFields.map(key => updates[key]);
      await client.query(
        `UPDATE users SET ${setClause} WHERE id=$1`,
        [req.user.id, ...values]
      );
    }

    // === 5. Save updated documents list ===
    await client.query(
      'UPDATE users SET documents=$1 WHERE id=$2',
      [JSON.stringify(docs), req.user.id]
    );

    res.json({ msg: 'Profile updated successfully' });
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ msg: 'Update failed' });
  } finally {
    client.release();
  }
};

const applyJob = async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  const client = await global.db.connect();

  try {
    const check = await client.query(
      'SELECT * FROM applications WHERE job_id=$1 AND user_id=$2',
      [jobId, userId]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ msg: 'Already applied' });
    }

    await client.query(
      `INSERT INTO applications (job_id, user_id, status) VALUES ($1, $2, 'pending')`,
      [jobId, userId]
    );

    res.json({ msg: 'Applied successfully' });
  } catch (e) {
    res.status(500).json({ msg: 'Apply failed' });
  } finally {
    client.release();
  }
};

const getApplications = async (req, res) => {
  const client = await global.db.connect();
  try {
    const { rows } = await client.query(
      `SELECT a.*, j.title, j.description, u.name as company_name
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN users u ON j.company_id = u.id
       WHERE a.user_id = $1`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ msg: 'Fetch failed' });
  } finally {
    client.release();
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  applyJob,
  getApplications
};