// controllers/adminController.js
const getStats = async (req, res) => {
  const client = await global.db.connect();
  try {
    const stats = await Promise.all([
      client.query('SELECT COUNT(*) FROM users WHERE role=$1', ['member']),
      client.query('SELECT COUNT(*) FROM users WHERE role=$1', ['company']),
      client.query('SELECT COUNT(*) FROM jobs WHERE status=$1', ['open']),
      client.query('SELECT COUNT(*) FROM applications'),
    ]);

    res.json({
      members: +stats[0].rows[0].count,
      companies: +stats[1].rows[0].count,
      openJobs: +stats[2].rows[0].count,
      totalApplications: +stats[3].rows[0].count,
    });
  } catch (e) {
    res.status(500).json({ msg: 'Stats error' });
  } finally {
    client.release();
  }
};

const updateRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body; // 'member', 'company', 'admin', 'leader'
  if (!['member', 'company', 'admin', 'leader'].includes(role)) {
    return res.status(400).json({ msg: 'Invalid role' });
  }

  const client = await global.db.connect();
  try {
    await client.query('UPDATE users SET role=$1 WHERE id=$2', [role, userId]);
    res.json({ msg: 'Role updated' });
  } catch (e) {
    res.status(500).json({ msg: 'Update failed' });
  } finally {
    client.release();
  }
};

module.exports = { getStats, updateRole };