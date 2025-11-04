// controllers/companyController.js
const searchCandidates = async (req, res) => {
  const { skills, education, specialization } = req.query;
  const client = await global.db.connect();

  try {
    let query = `
      SELECT id, name, email, skills, education, specialization, documents 
      FROM users 
      WHERE role = $1
    `;
    const values = ['member'];
    let paramIndex = 2;

    if (skills) {
      query += ` AND skills ILIKE $${paramIndex}`;
      values.push(`%${skills}%`);
      paramIndex++;
    }
    if (education) {
      query += ` AND education ILIKE $${paramIndex}`;
      values.push(`%${education}%`);
      paramIndex++;
    }
    if (specialization) {
      query += ` AND specialization ILIKE $${paramIndex}`;
      values.push(`%${specialization}%`);
      paramIndex++;
    }

    const { rows } = await client.query(query, values);

    // Parse JSON documents
    rows.forEach(row => {
      try {
        row.documents = row.documents ? JSON.parse(row.documents) : [];
      } catch (e) {
        row.documents = [];
      }
    });

    res.json(rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ msg: 'Search failed' });
  } finally {
    client.release();
  }
};

module.exports = { searchCandidates };