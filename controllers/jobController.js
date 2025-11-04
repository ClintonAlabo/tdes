// controllers/jobController.js
const createJob = async (req, res) => {
  const { title, description, requirements } = req.body;
  const companyId = req.user && req.user.id; // assume logged-in company
  const client = await global.db.connect();
  try {
    const q = `INSERT INTO jobs (title,description,company_id,requirements,status)
       VALUES ($1,$2,$3,$4,'open') RETURNING *`;
    const { rows } = await client.query(q, [title, description, companyId, requirements]);
    res.json(rows[0]);
  } catch (e) {
    console.error('createJob error', e);
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

const getJobs = async (req, res) => {
  const client = await global.db.connect();
  try {
    const { rows } = await client.query('SELECT * FROM jobs WHERE status=$1', ['open']);
    res.json(rows);
  } catch (e) {
    console.error('getJobs error', e);
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

const getJob = async (req, res) => {
  const { id } = req.params;
  const client = await global.db.connect();
  try {
    const { rows } = await client.query('SELECT * FROM jobs WHERE id=$1', [id]);
    if (rows.length === 0) return res.status(404).json({ msg: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('getJob error', e);
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

const updateJob = async (req, res) => {
  const { id } = req.params;
  const { title, description, requirements, status } = req.body;
  const client = await global.db.connect();
  try {
    const q = `UPDATE jobs SET title=$1, description=$2, requirements=$3, status=COALESCE($4,status)
               WHERE id=$5 RETURNING *`;
    const { rows } = await client.query(q, [title, description, requirements, status, id]);
    if (rows.length === 0) return res.status(404).json({ msg: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('updateJob error', e);
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

const deleteJob = async (req, res) => {
  const { id } = req.params;
  const client = await global.db.connect();
  try {
    await client.query('DELETE FROM jobs WHERE id=$1', [id]);
    res.json({ msg: 'Deleted' });
  } catch (e) {
    console.error('deleteJob error', e);
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

module.exports = { createJob, getJobs, getJob, updateJob, deleteJob };
