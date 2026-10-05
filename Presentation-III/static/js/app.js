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
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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
      text.textContent = `MySQL Connected (${data.connection.version})`;
      if (data.stats) {
        document.getElementById('stat-books').textContent = data.stats.total_books ?? 0;
        document.getElementById('stat-copies').textContent = data.stats.total_copies ?? 0;
        document.getElementById('stat-members').textContent = data.stats.total_members ?? 0;
        document.getElementById('stat-loans').textContent = data.stats.active_loans ?? 0;
        document.getElementById('stat-fines').textContent = `₹${data.stats.unpaid_fines ?? 0}`;
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
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No books found in database.</td></tr>';
    return;
  }
  tbody.innerHTML = books.map(b => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 600;">${b.BookID}</td>
      <td style="font-family: var(--font-mono); font-size: 0.78rem;">${b.ISBN}</td>
      <td style="font-weight: 600;">${b.Title}</td>
      <td><span class="badge badge-category">${b.Category}</span></td>
      <td>${b.Authors}</td>
      <td style="color: var(--muted);">${b.Publisher}</td>
      <td>
        <span class="badge ${b.Available_Copies > 0 ? 'badge-available' : 'badge-issued'}">
          ${b.Available_Copies} / ${b.Total_Copies} available
        </span>
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.BookID}, '${b.Title.replace(/'/g, "\\'")}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">No circulation records found.</td></tr>';
    return;
  }
  tbody.innerHTML = issues.map(iss => {
    let statusBadge = '<span class="badge badge-issued">Active</span>';
    if (iss.Loan_Status === 'Returned') {
      statusBadge = '<span class="badge badge-available">Returned</span>';
    } else if (iss.Loan_Status === 'Overdue') {
      statusBadge = '<span class="badge badge-overdue">Overdue</span>';
    }

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 600;">#${iss.IssueID}</td>
        <td style="font-weight: 600;">${iss.Member_Name}</td>
        <td>${iss.Book_Title}</td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${iss.AccessionNo}</td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${iss.IssueDate}</td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${iss.DueDate}</td>
        <td>${statusBadge}</td>
        <td style="font-family: var(--font-mono); font-weight: 600; color: ${iss.Fine_Amount > 0 ? 'var(--negative)' : 'var(--muted)'};">
          ${iss.Fine_Amount > 0 ? `₹${iss.Fine_Amount}` : '-'}
        </td>
        <td>
          ${iss.Loan_Status !== 'Returned' ? 
            `<button class="btn btn-secondary btn-sm" onclick="returnBook(${iss.IssueID})">📥 Return</button>` : 
            `<span style="color: var(--muted); font-size: 0.78rem;">Closed</span>`
          }
        </td>
      </tr>
    `;
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No members found.</td></tr>';
    return;
  }
  tbody.innerHTML = members.map(m => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 600;">${m.MemberID}</td>
      <td style="font-weight: 600;">${m.Name}</td>
      <td>${m.Email}</td>
      <td><span class="badge badge-category">${m.MemberType}</span></td>
      <td>${m.Total_Issued} books</td>
      <td style="font-family: var(--font-mono); font-weight: 600; color: ${m.Total_Fines > 0 ? 'var(--negative)' : 'var(--positive)'};">
        ₹${m.Total_Fines}
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.MemberID}, '${m.Name.replace(/'/g, "\\'")}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
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
  const thead = document.getElementById('q-thead');
  const tbody = document.getElementById('q-tbody');
  const title = document.getElementById('q-title');
  const desc = document.getElementById('q-desc');
  const meta = document.getElementById('q-meta');
  const code = document.getElementById('q-code');

  title.textContent = `Loading Query ${queryId}...`;
  tbody.innerHTML = '<tr><td style="text-align:center; padding: 2rem;">Executing SQL against MySQL 9.7...</td></tr>';

  try {
    const res = await fetch(`/api/query/${queryId}`);
    const json = await res.json();
    if (json.success) {
      title.textContent = json.title;
      desc.textContent = json.description;
      meta.textContent = `${json.row_count} rows in set (${json.execution_time_sec} sec)`;
      code.textContent = json.sql;

      // Render columns
      thead.innerHTML = `<tr>${json.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;

      // Render rows
      tbody.innerHTML = json.data.map(row => `
        <tr>
          ${json.columns.map(c => `<td style="font-family: var(--font-mono); font-size: 0.8rem;">${row[c]}</td>`).join('')}
        </tr>
      `).join('');
    } else {
      title.textContent = `Query ${queryId} Execution Error`;
      desc.textContent = json.error;
      code.textContent = json.sql || '--';
      tbody.innerHTML = `<tr><td style="text-align:center; color: var(--negative); padding: 2rem;">${json.error}</td></tr>`;
    }
  } catch (err) {
    title.textContent = `Query ${queryId} Failed`;
    tbody.innerHTML = `<tr><td style="text-align:center; color: var(--negative); padding: 2rem;">Failed to execute query.</td></tr>`;
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
