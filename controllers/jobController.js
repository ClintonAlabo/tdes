const createJob = async (req, res) => {
  const { title, description, requirements } = req.body;
  const companyId = req.user.id; // assume logged-in company
  const client = await global.db.connect();
  try {
    await client.query(
      `INSERT INTO jobs (title,description,company_id,requirements,status)
       VALUES ($1,$2,$3,$4,'open')`,
      [title, description, companyId, requirements]
    );
    res.json({ msg: 'Job posted' });
  } catch (e) {
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
    res.status(500).json({ msg: 'Error' });
  } finally {
    client.release();
  }
};

module.exports = { createJob, getJobs, /* getJob, updateJob, deleteJob */ };