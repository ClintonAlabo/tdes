// public/script.js
const API = '/api';
let token = localStorage.getItem('token');
let role = localStorage.getItem('role');
let userName = localStorage.getItem('name') || 'User';

// === ROLE-BASED AUTH ===
function checkAuth() {
  if (!token) {
    if (!['/', '/index.html', '/login.html', '/register.html'].includes(location.pathname)) {
      location.href = '/login.html';
    }
    return;
  }

  const nav = document.getElementById('navLinks');
  if (nav) {
    nav.innerHTML = `<a href="profile.html">${userName}</a> <a href="#" id="logout">Logout</a>`;
  }

  document.getElementById('logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    location.href = '/';
  });

  // Redirect by role
  if (role === 'admin' && !location.pathname.includes('admin-dashboard')) {
    location.href = '/admin-dashboard.html';
  } else if (role === 'company' && !location.pathname.includes('company-dashboard') && !location.pathname.includes('search')) {
    location.href = '/company-dashboard.html';
  } else if (role === 'member' && (location.pathname.includes('admin') || location.pathname.includes('company-dashboard'))) {
    location.href = '/profile.html';
  }
}

// === FETCH API ===
async function fetchAPI(url, opts = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

// === LOGIN ===
document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const res = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json());

  if (res.token) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('role', res.role);
    localStorage.setItem('name', res.name);
    location.href = '/';
  } else {
    alert(res.msg);
  }
});

// === REGISTER ===
document.getElementById('registerForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const res = await fetch(API + '/register', {
    method: 'POST',
    body: form
  }).then(r => r.json());
  alert(res.msg);
  if (res.msg.includes('success')) location.href = '/login.html';
});

// === RESUME PARSING FUNCTION ===
async function parseResume(file) {
  const arrayBuffer = await file.arrayBuffer();

  if (file.name.endsWith('.pdf')) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return extractStructuredData(text);
  }

  if (file.name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return extractStructuredData(result.value);
  }

  return null;
}

// === STRUCTURED DATA EXTRACTION (Heuristic-based) ===
function extractStructuredData(text) {
  const data = {};

  // Name (first line or before email)
  const nameMatch = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/m);
  data.name = nameMatch ? nameMatch[0].trim() : '';

  // Email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  data.email = emailMatch ? emailMatch[0] : '';

  // Phone
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  data.phone = phoneMatch ? phoneMatch[0] : '';

  // Education
  const eduLines = text.split('\n').filter(line => 
    line.match(/(university|college|institute|bachelor|master|diploma|phd)/i)
  );
  data.education = eduLines.join(', ');

  // Skills (comma-separated or bullet list)
  const skillsSection = text.match(/skills?[\s\S]*?([A-Za-z#,.\s]+)/i);
  data.skills = skillsSection ? skillsSection[1].replace(/\n/g, ', ').substring(0, 200) : '';

  // Experience
  const expSection = text.match(/(experience|work|employment)[\s\S]*?([A-Za-z0-9\s,.-]+)/i);
  data.employmentHistory = expSection ? expSection[2].substring(0, 500) : '';

  return data;
}

// === PROFILE PAGE WITH RESUME PARSING ===
if (location.pathname.includes('profile.html')) {
  let currentDocs = [];

  // Load profile
  (async () => {
    const profile = await fetchAPI(API + '/profile');
    document.getElementById('name').value = profile.name || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('age').value = profile.age || '';
    document.getElementById('education').value = profile.education || '';
    document.getElementById('specialization').value = profile.specialization || '';
    document.getElementById('occupation').value = profile.occupation || '';
    document.getElementById('skills').value = profile.skills || '';
    document.getElementById('talents').value = profile.talents || '';
    document.getElementById('employmentHistory').value = profile.employment_history || '';

    currentDocs = profile.documents || [];
    renderDocuments();
  })();

  // Render uploaded documents
  function renderDocuments() {
    const list = document.getElementById('documentsList');
    list.innerHTML = currentDocs.map((url, i) => `
      <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
        <a href="${url}" target="_blank">Document ${i+1}</a>
        <button onclick="removeDoc(${i})" style="color:red; font-size:12px;">Remove</button>
      </div>
    `).join('');
  }

  window.removeDoc = (i) => {
    currentDocs.splice(i, 1);
    renderDocuments();
  };

  // File input change → parse resume
  const fileInput = document.querySelector('input[name="documents"]');
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show parsing status
    const status = document.createElement('p');
    status.id = 'parseStatus';
    status.textContent = 'Parsing resume...';
    status.style.color = '#0000FF';
    fileInput.parentNode.appendChild(status);

    try {
      const parsed = await parseResume(file);
      if (parsed) {
        // Auto-fill form
        if (parsed.name) document.getElementById('name').value = parsed.name;
        if (parsed.email) document.getElementById('email').value = parsed.email;
        if (parsed.education) document.getElementById('education').value = parsed.education;
        if (parsed.skills) document.getElementById('skills').value = parsed.skills;
        if (parsed.employmentHistory) document.getElementById('employmentHistory').value = parsed.employmentHistory;

        alert('Resume parsed! Fields auto-filled.');
      }
    } catch (err) {
      console.error(err);
      alert('Could not parse resume. Please fill manually.');
    } finally {
      document.getElementById('parseStatus')?.remove();
    }
  });

  // Submit profile
  document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.target);

    // Append current documents (to preserve old ones)
    form.append('existingDocs', JSON.stringify(currentDocs));

    const res = await fetch(API + '/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }).then(r => r.json());

    alert(res.msg);
    location.reload();
  });
}

// === JOB BOARD ===
if (location.pathname.includes('job-board.html')) {
  (async () => {
    const jobs = await fetchAPI(API + '/jobs');
    const list = document.getElementById('jobList');
    list.innerHTML = jobs.map(j => `
      <div class="card">
        <h3>${j.title}</h3>
        <p><strong>${j.company_name}</strong></p>
        <p>${j.description}</p>
        <p><em>${j.requirements}</em></p>
        <button onclick="applyJob(${j.id})">Apply Now</button>
      </div>
    `).join('');
  })();
}

window.applyJob = async (jobId) => {
  const res = await fetchAPI(API + `/apply/${jobId}`, { method: 'POST' });
  alert(res.msg);
};

// === COMPANY DASHBOARD ===
if (location.pathname.includes('company-dashboard.html')) {
  (async () => {
    const jobs = await fetchAPI(API + '/jobs');
    const list = document.getElementById('companyJobs');
    list.innerHTML = jobs.map(j => `
      <div class="card">
        <h4>${j.title}</h4>
        <p>${j.description}</p>
        <button onclick="deleteJob(${j.id})" style="background:red;color:white;">Delete</button>
      </div>
    `).join('');
  })();

  document.getElementById('postJobForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetchAPI(API + '/jobs', { method: 'POST', body: JSON.stringify(data) });
    alert('Job posted!');
    location.reload();
  });

  window.deleteJob = async (id) => {
    if (!confirm('Delete this job?')) return;
    await fetchAPI(API + `/jobs/${id}`, { method: 'DELETE' });
    location.reload();
  };
}

// === ADMIN DASHBOARD ===
if (location.pathname.includes('admin-dashboard.html')) {
  (async () => {
    const stats = await fetchAPI(API + '/admin/stats');
    document.getElementById('stats').innerHTML = `
      <p><strong>Members:</strong> ${stats.members}</p>
      <p><strong>Companies:</strong> ${stats.companies}</p>
      <p><strong>Open Jobs:</strong> ${stats.openJobs}</p>
      <p><strong>Applications:</strong> ${stats.totalApplications}</p>
    `;
  })();

  document.getElementById('roleForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetchAPI(API + `/admin/role/${data.userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role: data.role })
    });
    alert('Role updated');
  });
}

// === SEARCH CANDIDATES ===
if (location.pathname.includes('search.html')) {
  document.getElementById('searchForm').addEventListener('submit', async e => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.target));
    const results = await fetch(API + '/search?' + params, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());

    const list = document.getElementById('searchResults');
    list.innerHTML = results.map(u => `
      <div class="card">
        <h4>${u.name}</h4>
        <p>Email: ${u.email}</p>
        <p>Skills: ${u.skills}</p>
        <p>Education: ${u.education}</p>
        <a href="${u.documents[0]}" target="_blank">View CV</a>
      </div>
    `).join('');
  });
}

// === NOTIFICATIONS ===
if (location.pathname.includes('notifications.html')) {
  (async () => {
    const apps = await fetchAPI(API + '/applications');
    const list = document.getElementById('notificationsList');
    list.innerHTML = apps.map(a => `
      <div class="card">
        <h4>${a.title}</h4>
        <p>Company: ${a.company_name}</p>
        <p>Status: <strong style="color: ${a.status === 'accepted' ? 'green' : a.status === 'rejected' ? 'red' : 'orange'}">${a.status}</strong></p>
      </div>
    `).join('');
  })();
}

// === LOAD PDF.js for PDF parsing ===
let pdfjsLib;
if (typeof window !== 'undefined' && location.pathname.includes('profile.html')) {
  const script = document.createElement('script');
  script.src = 'https://mozilla.github.io/pdf.js/build/pdf.min.js';
  script.onload = () => { pdfjsLib = window['pdfjs-dist/build/pdf']; };
  document.head.appendChild(script);
}

// Run auth on load
document.addEventListener('DOMContentLoaded', checkAuth);