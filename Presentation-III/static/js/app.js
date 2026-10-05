// Global state cache
let booksData = [];
let issuesData = [];
let membersData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  loadBooks();
  loadIssues();
  loadMembers();
  loadDigital();
  loadQuery(1); // default load Query 1
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✔' : '✕';
  toast.innerHTML = `<span style="font-size:1rem;font-weight:800;">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Check MySQL connection status & stats
async function checkStatus() {
  const pill = document.getElementById('db-status-pill');
  const text = document.getElementById('db-status-text');
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.connection && data.connection.status === 'connected') {
      pill.className = 'db-pill connected';
      text.textContent = `MySQL ${data.connection.version} · ${data.connection.host}`;
      if (data.stats) {
        animateCounter('stat-books',   data.stats.total_books   ?? 0);
        animateCounter('stat-copies',  data.stats.total_copies  ?? 0);
        animateCounter('stat-members', data.stats.total_members ?? 0);
        animateCounter('stat-loans',   data.stats.active_loans  ?? 0);
        document.getElementById('stat-fines').textContent = `₹${(data.stats.unpaid_fines ?? 0).toFixed(0)}`;
      }
    } else {
      pill.className = 'db-pill error';
      text.textContent = 'MySQL Disconnected';
    }
  } catch (err) {
    pill.className = 'db-pill error';
    text.textContent = 'Connection Error';
  }
}

// Animated number counter
function animateCounter(elId, end) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const step = (end - start) / (duration / 16);
  let cur = start;
  const timer = setInterval(() => {
    cur += step;
    if ((step > 0 && cur >= end) || (step < 0 && cur <= end)) {
      clearInterval(timer);
      el.textContent = end;
    } else {
      el.textContent = Math.round(cur);
    }
  }, 16);
}

// Tab navigation
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  event.currentTarget.classList.add('active');
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
}

// Modal management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// ============================================================================
// BOOKS (VIEW, INSERT, DELETE)
// ============================================================================

async function loadBooks() {
  const tbody = document.getElementById('books-tbody');
  try {
    const res = await fetch('/api/books');
    const json = await res.json();
    if (json.success) {
      booksData = json.data;
      renderBooks(booksData);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--negative); padding: 2rem;">Error: ${json.error}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--negative); padding: 2rem;">Failed to connect to database.</td></tr>`;
  }
}

function renderBooks(books) {
  const tbody = document.getElementById('books-tbody');
  if (!books || books.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No books found in the database.</td></tr>';
    return;
  }
  tbody.innerHTML = books.map(b => {
    const pct = b.Total_Copies > 0 ? Math.round((b.Available_Copies / b.Total_Copies) * 100) : 0;
    const barColor = pct === 0 ? '#3F3F46' : pct < 50 ? '#A1A1AA' : '#FAFAFA';
    const issueBtn = b.Available_Copies > 0
      ? `<button class="btn btn-primary btn-sm" onclick="openIssueBookForBook(${b.BookID})">Borrow Copy</button>`
      : `<span style="color:var(--text-muted);font-size:0.76rem;">Unavailable</span>`;
    return `
    <tr>
      <td>${b.BookID}</td>
      <td style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text-muted);">${b.ISBN}</td>
      <td class="title-cell">${b.Title}</td>
      <td><span class="badge badge-category">${b.Category}</span></td>
      <td style="color:var(--text-secondary);">${b.Authors}</td>
      <td style="color:var(--text-muted);font-size:0.8rem;">${b.Publisher}</td>
      <td>
        <div class="copy-bar">
          <div class="copy-bar-track"><div class="copy-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
          <span class="copy-text">${b.Available_Copies}/${b.Total_Copies}</span>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          ${issueBtn}
          <button class="btn btn-danger btn-sm admin-only" onclick="deleteBook(${b.BookID}, '${b.Title.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterBooks() {
  const q = document.getElementById('book-search').value.toLowerCase();
  const filtered = booksData.filter(b => 
    b.Title.toLowerCase().includes(q) ||
    b.Authors.toLowerCase().includes(q) ||
    b.Category.toLowerCase().includes(q) ||
    b.ISBN.toLowerCase().includes(q)
  );
  renderBooks(filtered);
}

async function openAddBookModal() {
  try {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (json.success) {
      const catSelect = document.getElementById('b-category');
      const pubSelect = document.getElementById('b-publisher');
      catSelect.innerHTML = json.categories.map(c => `<option value="${c.CategoryID}">${c.CategoryName}</option>`).join('');
      pubSelect.innerHTML = json.publishers.map(p => `<option value="${p.PublisherID}">${p.PublisherName}</option>`).join('');
      openModal('add-book-modal');
    }
  } catch (err) {
    showToast('Failed to load categories/publishers.', 'error');
  }
}

async function submitAddBook(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('b-title').value,
    isbn: document.getElementById('b-isbn').value,
    author: document.getElementById('b-author').value,
    category_id: document.getElementById('b-category').value,
    publisher_id: document.getElementById('b-publisher').value,
    copies: document.getElementById('b-copies').value
  };

  try {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeModal('add-book-modal');
      document.getElementById('add-book-form').reset();
      loadBooks();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to insert book.', 'error');
  }
}

async function deleteBook(bookId, bookTitle) {
  if (!confirm(`Are you sure you want to delete book "${bookTitle}" (ID: ${bookId}) and its physical copies from MySQL?`)) {
    return;
  }
  try {
    const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadBooks();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete book.', 'error');
  }
}

// ============================================================================
// ISSUES & CIRCULATION
// ============================================================================

async function loadIssues() {
  const tbody = document.getElementById('issues-tbody');
  try {
    const res = await fetch('/api/issues');
    const json = await res.json();
    if (json.success) {
      issuesData = json.data;
      renderIssues(issuesData);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;">Failed to load issues.</td></tr>`;
  }
}

function renderIssues(issues) {
  const tbody = document.getElementById('issues-tbody');
  if (!issues || issues.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No circulation records found.</td></tr>';
    return;
  }
  tbody.innerHTML = issues.map(iss => {
    const statusMap = {
      'Active':   '<span class="badge badge-issued">Active</span>',
      'Returned': '<span class="badge badge-returned">Returned</span>',
      'Overdue':  '<span class="badge badge-overdue">Overdue</span>',
    };
    const badge = statusMap[iss.Loan_Status] || `<span class="badge">${iss.Loan_Status}</span>`;
    const fine = iss.Fine_Amount > 0
      ? `<span style="font-family:var(--font-mono);font-weight:700;color:var(--text-primary);">Rs. ${iss.Fine_Amount}</span>`
      : `<span style="color:var(--text-muted);">-</span>`;
    const action = iss.Loan_Status !== 'Returned'
      ? `<button class="btn btn-primary btn-sm admin-only" onclick="returnBook(${iss.IssueID})">Return Copy</button>`
      : `<span style="color:var(--text-muted);font-size:0.76rem;">Closed</span>`;
    return `
      <tr>
        <td>#${iss.IssueID}</td>
        <td style="font-weight:600;color:var(--text-primary);">${iss.Member_Name}</td>
        <td class="title-cell">${iss.Book_Title}</td>
        <td style="font-family:var(--font-mono);font-size:0.76rem;">${iss.AccessionNo}</td>
        <td style="font-family:var(--font-mono);font-size:0.76rem;">${iss.IssueDate}</td>
        <td style="font-family:var(--font-mono);font-size:0.76rem;">${iss.DueDate}</td>
        <td>${badge}</td>
        <td>${fine}</td>
        <td>${action}</td>
      </tr>`;
  }).join('');
}

function filterIssues() {
  const q = document.getElementById('issue-search').value.toLowerCase();
  const filtered = issuesData.filter(iss => 
    iss.Member_Name.toLowerCase().includes(q) ||
    iss.Book_Title.toLowerCase().includes(q) ||
    iss.AccessionNo.toLowerCase().includes(q)
  );
  renderIssues(filtered);
}

async function openIssueBookModal() {
  try {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (json.success) {
      const memSelect = document.getElementById('iss-member');
      const copySelect = document.getElementById('iss-copy');
      memSelect.innerHTML = json.members.map(m => `<option value="${m.MemberID}">${m.Name} (${m.Email})</option>`).join('');
      if (json.available_copies.length === 0) {
        copySelect.innerHTML = '<option disabled>No physical copies currently available on shelf</option>';
      } else {
        copySelect.innerHTML = json.available_copies.map(c => `<option value="${c.CopyID}">${c.Title} [${c.AccessionNo}]</option>`).join('');
      }
      openModal('issue-book-modal');
    }
  } catch (err) {
    showToast('Failed to load issue metadata.', 'error');
  }
}

async function openIssueBookForBook(bookId) {
  try {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (json.success) {
      const memSelect = document.getElementById('iss-member');
      const copySelect = document.getElementById('iss-copy');
      memSelect.innerHTML = json.members.map(m => `<option value="${m.MemberID}">${m.Name} (${m.Email})</option>`).join('');
      
      const filteredCopies = json.available_copies.filter(c => c.BookID == bookId || c.Book_ID == bookId);
      const targetCopies = filteredCopies.length > 0 ? filteredCopies : json.available_copies;

      if (targetCopies.length === 0) {
        copySelect.innerHTML = '<option disabled>No physical copies currently available on shelf</option>';
      } else {
        copySelect.innerHTML = targetCopies.map(c => `<option value="${c.CopyID}">${c.Title} [${c.AccessionNo}]</option>`).join('');
      }
      openModal('issue-book-modal');
    }
  } catch (err) {
    showToast('Failed to load copy metadata.', 'error');
  }
}

async function submitIssueBook(e) {
  e.preventDefault();
  const payload = {
    member_id: document.getElementById('iss-member').value,
    copy_id: document.getElementById('iss-copy').value,
    days: document.getElementById('iss-days').value
  };

  try {
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeModal('issue-book-modal');
      loadIssues();
      loadBooks();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to issue book.', 'error');
  }
}

async function returnBook(issueId) {
  try {
    const res = await fetch(`/api/return/${issueId}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadIssues();
      loadBooks();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to return book.', 'error');
  }
}

// ============================================================================
// MEMBERS
// ============================================================================

async function loadMembers() {
  const tbody = document.getElementById('members-tbody');
  try {
    const res = await fetch('/api/members');
    const json = await res.json();
    if (json.success) {
      membersData = json.data;
      renderMembers(membersData);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Failed to load members.</td></tr>`;
  }
}

function renderMembers(members) {
  const tbody = document.getElementById('members-tbody');
  if (!members || members.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No members found.</td></tr>';
    return;
  }
  tbody.innerHTML = members.map(m => {
    const typeBadge = m.MemberType === 'Faculty'
      ? `<span class="badge badge-faculty">Faculty</span>`
      : m.MemberType === 'Staff'
        ? `<span class="badge badge-issued">Staff</span>`
        : `<span class="badge badge-student">Student</span>`;
    const fineHtml = m.Total_Fines > 0
      ? `<span class="fine-amount has-fine">Rs. ${m.Total_Fines}</span>`
      : `<span class="fine-amount no-fine">Rs. 0</span>`;
    return `
    <tr>
      <td>${m.MemberID}</td>
      <td style="font-weight:600;color:var(--text-primary);">${m.Name}</td>
      <td style="color:var(--text-muted);font-size:0.82rem;">${m.Email}</td>
      <td>${typeBadge}</td>
      <td style="font-family:var(--font-mono);">${m.Total_Issued}</td>
      <td>${fineHtml}</td>
      <td class="admin-only"><button class="btn btn-danger btn-sm" onclick="deleteMember(${m.MemberID}, '${m.Name.replace(/'/g, "\\'")}')">Delete</button></td>
    </tr>`;
  }).join('');
}

function filterMembers() {
  const q = document.getElementById('member-search').value.toLowerCase();
  const filtered = membersData.filter(m => 
    m.Name.toLowerCase().includes(q) ||
    m.Email.toLowerCase().includes(q) ||
    m.MemberType.toLowerCase().includes(q)
  );
  renderMembers(filtered);
}

async function submitAddMember(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('m-name').value,
    email: document.getElementById('m-email').value,
    member_type: document.getElementById('m-type').value
  };

  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      closeModal('add-member-modal');
      document.getElementById('add-member-form').reset();
      loadMembers();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to register member.', 'error');
  }
}

async function deleteMember(memberId, name) {
  if (!confirm(`Are you sure you want to delete member "${name}" (ID: ${memberId}) from MySQL?`)) {
    return;
  }
  try {
    const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      loadMembers();
      checkStatus();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete member.', 'error');
  }
}

// ============================================================================
// DIGITAL RESOURCES
// ============================================================================

async function loadDigital() {
  try {
    const res = await fetch('/api/digital-resources');
    const json = await res.json();
    if (json.success) {
      const dBody = document.getElementById('digital-tbody');
      dBody.innerHTML = json.resources.map(d => `
        <tr>
          <td style="font-family: var(--font-mono); font-weight: 600;">${d.ResourceID}</td>
          <td style="font-weight: 600;">${d.Title}</td>
          <td><span class="badge badge-format">${d.Format}</span></td>
          <td><a href="${d.AccessURL}" target="_blank" style="color: var(--accent2); text-decoration: none; font-family: var(--font-mono); font-size: 0.78rem;">${d.AccessURL} ↗</a></td>
        </tr>
      `).join('');

      const lBody = document.getElementById('access-logs-tbody');
      lBody.innerHTML = json.logs.map(l => `
        <tr>
          <td style="font-family: var(--font-mono);">${l.LogID}</td>
          <td style="font-weight: 600;">${l.Member_Name}</td>
          <td>${l.Resource_Title}</td>
          <td><span class="badge badge-format">${l.Format}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">${l.AccessDate}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load digital resources', err);
  }
}

// ============================================================================
// THE 5 EVALUATED QUERIES
// ============================================================================

async function loadQuery(queryId) {
  const thead    = document.getElementById('q-thead');
  const tbody    = document.getElementById('q-tbody');
  const title    = document.getElementById('q-title');
  const desc     = document.getElementById('q-desc');
  const metaEl   = document.getElementById('q-meta');
  const metaTxt  = document.getElementById('q-meta-text');
  const code     = document.getElementById('q-code');

  // Highlight active query button
  document.querySelectorAll('.btn-query').forEach(b => b.classList.remove('active-query'));
  const btn = document.getElementById('qbtn-' + queryId);
  if (btn) btn.classList.add('active-query');

  title.textContent = `⏳ Executing Query ${queryId}…`;
  tbody.innerHTML = '<tr class="empty-row"><td>Running SQL against MySQL 9.7…</td></tr>';
  if (metaEl) metaEl.style.display = 'none';

  try {
    const res  = await fetch(`/api/query/${queryId}`);
    const json = await res.json();
    if (json.success) {
      title.textContent = json.title;
      desc.textContent  = json.description;
      if (metaEl && metaTxt) {
        metaTxt.textContent = `${json.row_count} rows · ${json.execution_time_sec}s`;
        metaEl.style.display = 'flex';
      }
      // SQL syntax highlight (simple keywords)
      const highlighted = json.sql
        .replace(/\b(SELECT|FROM|JOIN|LEFT|INNER|WHERE|GROUP BY|ORDER BY|HAVING|COUNT|SUM|CONCAT|IFNULL|AS|ON|AND|OR|NOT|IS|NULL|BY|DESC|ASC|LIMIT|DISTINCT|UPDATE|INSERT|DELETE)\b/g, '<span class="kw">$1</span>')
        .replace(/\b(CURDATE|NOW|DATE|DATEDIFF)\b/g, '<span class="fn">$1</span>');
      code.innerHTML = highlighted;

      thead.innerHTML = `<tr>${json.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
      tbody.innerHTML = json.data.length === 0
        ? '<tr class="empty-row"><td colspan="99">Query returned 0 rows.</td></tr>'
        : json.data.map(row => `
          <tr>${json.columns.map(c => {
            const val = row[c] ?? 'NULL';
            return `<td style="font-family:var(--font-mono);font-size:0.79rem;">${val}</td>`;
          }).join('')}</tr>
        `).join('');

      document.getElementById('query-display-card').classList.add('has-results');
    } else {
      title.textContent = `⚠ Query ${queryId} Error`;
      desc.textContent  = json.error;
      code.textContent  = json.sql || '--';
      tbody.innerHTML   = `<tr class="empty-row"><td style="color:var(--rose);">${json.error}</td></tr>`;
    }
  } catch (err) {
    title.textContent = `⚠ Query ${queryId} Failed`;
    tbody.innerHTML   = `<tr class="empty-row"><td style="color:var(--rose);">Failed to execute. Is Flask running?</td></tr>`;
  }
}

// ============================================================================
// SYSTEM & DB ACTIONS
// ============================================================================

async function initDatabase() {
  if (!confirm('This will execute library_db.sql against MySQL, recreating all 13 tables and seeding the portal data. Continue?')) {
    return;
  }
  try {
    const res = await fetch('/api/init-db', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      checkStatus();
      loadBooks();
      loadIssues();
      loadMembers();
      loadDigital();
      loadQuery(1);
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to seed database.', 'error');
  }
}

async function submitDbConfig(e) {
  e.preventDefault();
  const payload = {
    host: document.getElementById('cfg-host').value,
    port: document.getElementById('cfg-port').value,
    user: document.getElementById('cfg-user').value,
    password: document.getElementById('cfg-pass').value,
    database: document.getElementById('cfg-db').value
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('MySQL connected successfully!');
      closeModal('db-config-modal');
      checkStatus();
      loadBooks();
      loadIssues();
      loadMembers();
      loadDigital();
    } else {
      showToast(`Connection failed: ${json.result.message}`, 'error');
    }
  } catch (err) {
    showToast('Failed to update config.', 'error');
  }
}
