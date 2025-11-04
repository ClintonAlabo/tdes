// controllers/companyController.js
const searchCandidates = async (req, res) => {
  const { skills, education, specialization } = req.query;
  const client = await global.db.connect();
  try {
    let query = 'SELECT id, name, email, skills, education, specialization, documents FROM users WHERE role=$1';
    const values = ['member'];
    let idx = 2;

    if (skills) {
      query += ` AND skills ILIKE $${idx}`;
      values.push(`%${skills}%`);
      idx++;
    }
    if (education) {
      query += ` AND education ILIKE $${idx}`;
      values.push(`%${education}%`);
      idx++;
    }
    if (specialization) {
      query += ` AND specialization ILIKE $${idx}`;
      values.push(`%${specialization}%`);
    }

    const { rows } = await client.query(query, values);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Search failed' });
  } finally {
    client.release();
  }
};

module.exports = { searchCandidates };