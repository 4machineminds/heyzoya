// ── SUPABASE CLIENT (already initialised in dashboard.html as _supabase) ──
// This file runs after the inline script so _supabase is available.

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
}
function fmtDuration(secs) {
  if (!secs) return '0m';
  const m = Math.floor(secs / 60), s = secs % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW CHARTS
// ─────────────────────────────────────────────────────────────────────────────
async function initOverviewCharts(userId) {
  // Fetch last 7 days of calls
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: calls } = await _supabase
    .from('calls')
    .select('started_at, duration_seconds, status')
    .eq('user_id', userId)
    .gte('started_at', since)
    .order('started_at');

  // Build daily buckets
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const callsByDay = Array(7).fill(0);
  (calls || []).forEach(c => {
    const d = new Date(c.started_at).getDay(); // 0=Sun
    const idx = (d + 6) % 7;
    callsByDay[idx]++;
  });

  // Fetch leads per day
  const { data: leads } = await _supabase
    .from('leads')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since);

  const leadsByDay = Array(7).fill(0);
  (leads || []).forEach(l => {
    const d = new Date(l.created_at).getDay();
    const idx = (d + 6) % 7;
    leadsByDay[idx]++;
  });

  // Donut: call source breakdown (static until we track UTM)
  const donutCanvas = document.getElementById('donutChart');
  if (donutCanvas) {
    new Chart(donutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Organic', 'Referral', 'Direct'],
        datasets: [{ data: [80, 60, 50], backgroundColor: ['#f7d9a1','#f2b9b8','#7ab4ff'], borderColor: 'transparent', hoverOffset: 6 }],
      },
      options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } },
    });
  }

  // Bar: leads vs calls per day
  const barCanvas = document.getElementById('barChart');
  if (barCanvas) {
    new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: days,
        datasets: [
          { label: 'Leads', data: leadsByDay, backgroundColor: 'rgba(247,217,161,0.75)', borderRadius: 6, borderSkipped: false },
          { label: 'Calls', data: callsByDay, backgroundColor: 'rgba(242,185,184,0.65)', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7b8ba5', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#7b8ba5', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }

  // Line: call activity over 9 data points
  const lineCanvas = document.getElementById('leadsChart');
  if (lineCanvas) {
    const ctx = lineCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(78,245,138,0.22)');
    grad.addColorStop(1, 'rgba(78,245,138,0)');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Calls', data: callsByDay,
          borderColor: '#4ef58a', backgroundColor: grad,
          fill: true, tension: 0.45, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7b8ba5', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#7b8ba5', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW STATS + MINI APPOINTMENTS
// ─────────────────────────────────────────────────────────────────────────────
async function loadOverviewStats(userId) {
  const [{ count: leadCount }, { count: apptCount }, { count: activeCount }] = await Promise.all([
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    _supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'new'),
  ]);

  document.getElementById('statLeads').textContent  = leadCount  ?? 0;
  document.getElementById('statAppts').textContent  = apptCount  ?? 0;
  document.getElementById('statActive').textContent = activeCount ?? 0;

  // Mini appointments table
  const { data: recent } = await _supabase
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4);

  const tbody = document.getElementById('overviewApptRows');
  if (!tbody) return;

  if (!recent || recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px 0;font-size:13px">No appointments yet</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(a => {
    const initials = (a.client_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const dt = fmtDate(a.appt_date ? a.appt_date + 'T00:00:00' : a.created_at);
    const badge = a.status === 'confirmed' ? 'badge-confirmed' : a.status === 'pending' ? 'badge-pending' : 'badge-cancelled';
    return `<tr>
      <td style="display:flex;align-items:center;gap:8px">
        <div class="mini-avatar">${initials}</div>
        <span style="font-weight:500;color:#fff">${a.client_name}</span>
      </td>
      <td style="color:var(--muted)">${dt}</td>
      <td style="color:var(--muted)">${a.type || 'Consultation'}</td>
      <td><span class="badge ${badge}">${a.status}</span></td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS — real Supabase CRUD
// ─────────────────────────────────────────────────────────────────────────────
let _apptFilter = 'all';
let _apptSearch = '';
let _editingApptId = null;

async function loadAppointments(userId) {
  let query = _supabase
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .order('appt_date', { ascending: false });

  if (_apptFilter !== 'all') query = query.eq('status', _apptFilter);

  const { data, error } = await query;
  if (error) { console.error(error); return; }

  let list = data || [];
  if (_apptSearch) {
    const q = _apptSearch.toLowerCase();
    list = list.filter(a => a.client_name?.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q));
  }

  renderAppointmentRows(list);
}

function renderAppointmentRows(list) {
  const tbody = document.getElementById('apptBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div>No appointments found</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const badge = a.status === 'confirmed' ? 'badge-confirmed' : a.status === 'pending' ? 'badge-pending' : 'badge-cancelled';
    const dt = a.appt_date ? fmtDate(a.appt_date + 'T00:00:00') : '—';
    return `<tr>
      <td><div class="appt-name">${a.client_name}</div><div class="appt-detail">${a.client_phone || '—'}</div></td>
      <td><div>${dt}</div><div class="appt-detail">${a.appt_time ? fmtTime(a.appt_time) : ''}</div></td>
      <td>${a.type || '—'}</td>
      <td><span class="badge ${badge}">${a.status}</span></td>
      <td><div class="appt-actions">
        <button class="btn-icon" onclick="openApptModal('${a.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
        <button class="btn-icon" onclick="deleteAppt('${a.id}')" style="color:var(--danger)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}

async function saveAppointment() {
  const userId = window._currentUserId;
  if (!userId) return;

  const entry = {
    user_id:      userId,
    client_name:  document.getElementById('m-client').value.trim(),
    client_phone: document.getElementById('m-phone').value.trim(),
    appt_date:    document.getElementById('m-date').value || null,
    appt_time:    document.getElementById('m-time').value || null,
    type:         document.getElementById('m-type').value,
    status:       document.getElementById('m-status').value,
    notes:        document.getElementById('m-notes').value.trim(),
  };

  if (!entry.client_name || !entry.appt_date) { alert('Client name and date are required.'); return; }

  let error;
  if (_editingApptId) {
    ({ error } = await _supabase.from('appointments').update(entry).eq('id', _editingApptId));
  } else {
    ({ error } = await _supabase.from('appointments').insert(entry));
  }

  if (error) { showToast('Error: ' + error.message); return; }

  closeApptModal();
  await loadAppointments(userId);
  await loadOverviewStats(userId);
  showToast(_editingApptId ? 'Appointment updated!' : 'Appointment added!');
}

async function openApptModal(id = null) {
  _editingApptId = id;
  document.getElementById('modalTitle').textContent = id ? 'Edit Appointment' : 'New Appointment';

  if (id) {
    const { data: a } = await _supabase.from('appointments').select('*').eq('id', id).single();
    if (a) {
      document.getElementById('m-client').value = a.client_name || '';
      document.getElementById('m-phone').value  = a.client_phone || '';
      document.getElementById('m-date').value   = a.appt_date || '';
      document.getElementById('m-time').value   = a.appt_time || '';
      document.getElementById('m-type').value   = a.type || 'Consultation';
      document.getElementById('m-status').value = a.status || 'pending';
      document.getElementById('m-notes').value  = a.notes || '';
    }
  } else {
    ['m-client','m-phone','m-date','m-time','m-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-type').value   = 'Consultation';
    document.getElementById('m-status').value = 'confirmed';
  }

  document.getElementById('apptModal').classList.add('open');
}

function closeApptModal() { document.getElementById('apptModal').classList.remove('open'); }

async function deleteAppt(id) {
  if (!confirm('Delete this appointment?')) return;
  await _supabase.from('appointments').delete().eq('id', id);
  await loadAppointments(window._currentUserId);
  await loadOverviewStats(window._currentUserId);
  showToast('Appointment deleted.');
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADS SECTION — real data
// ─────────────────────────────────────────────────────────────────────────────
async function loadLeads(userId) {
  const { data: leads, error } = await _supabase
    .from('leads')
    .select('*, calls(duration_seconds, started_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const container = document.getElementById('leadsContainer');
  if (!container) return;

  if (error || !leads || leads.length === 0) {
    container.innerHTML = `<div class="card"><p style="color:var(--muted);font-size:14px;padding:24px 0;text-align:center">No leads yet — they'll appear here after Zoya handles calls.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="card" style="padding:0;overflow-x:auto;overflow-y:hidden">
      <table class="appt-table">
        <thead><tr>
          <th>Name</th><th>Phone</th><th>Intent</th><th>Status</th><th>Call Duration</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${leads.map(l => {
          const badge = l.status === 'new' ? 'badge-pending' : l.status === 'qualified' ? 'badge-confirmed' : l.status === 'lost' ? 'badge-cancelled' : 'badge-pending';
          return `<tr>
            <td><div class="appt-name">${l.name || '—'}</div></td>
            <td>${l.phone || '—'}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.intent || '—'}</td>
            <td><span class="badge ${badge}">${l.status}</span></td>
            <td>${fmtDuration(l.calls?.duration_seconds)}</td>
            <td style="color:var(--muted)">${fmtDate(l.created_at)}</td>
            <td><div class="appt-actions">
              <select class="btn-icon" style="cursor:pointer" onchange="updateLeadStatus('${l.id}', this.value)">
                <option value="new"       ${l.status==='new'?'selected':''}>New</option>
                <option value="contacted" ${l.status==='contacted'?'selected':''}>Contacted</option>
                <option value="qualified" ${l.status==='qualified'?'selected':''}>Qualified</option>
                <option value="lost"      ${l.status==='lost'?'selected':''}>Lost</option>
              </select>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}

async function updateLeadStatus(id, status) {
  const { error } = await _supabase.from('leads').update({ status }).eq('id', id);
  if (!error) showToast('Lead updated!');
  else showToast('Error: ' + error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE — load from Supabase for account section
// ─────────────────────────────────────────────────────────────────────────────
async function loadUsage(userId) {
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await _supabase
    .from('usage_monthly')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  if (!data) return;

  const mins    = parseFloat(data.total_minutes || 0).toFixed(1);
  const cost    = parseFloat(data.total_cost_usd || 0).toFixed(2);
  const calls   = data.total_calls || 0;

  const minsEl = document.getElementById('minsUsed');
  if (minsEl) minsEl.textContent = `${mins} min (${calls} calls)`;

  const fillEl = document.querySelector('.usage-fill');
  if (fillEl) {
    const pct = Math.min(100, (parseFloat(mins) / 100) * 100);
    fillEl.style.width = pct + '%';
  }

  const remainEl = document.querySelector('.usage-fill')?.closest('.usage-bar-wrap')?.nextElementSibling;
  if (remainEl) remainEl.textContent = `Est. bill this month: $${cost}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT — called from dashboard.html after auth resolves
// ─────────────────────────────────────────────────────────────────────────────
window.dashboardBoot = async function(userId) {
  window._currentUserId = userId;

  // Wire search + filters
  const searchEl = document.getElementById('apptSearch');
  if (searchEl) {
    searchEl.addEventListener('input', e => { _apptSearch = e.target.value; loadAppointments(userId); });
  }
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      _apptFilter = chip.dataset.filter;
      loadAppointments(userId);
    });
  });

  // Expose modal functions globally (called from HTML onclick)
  window.openApptModal  = openApptModal;
  window.closeApptModal = closeApptModal;
  window.saveAppointment = saveAppointment;
  window.deleteAppt      = deleteAppt;
  window.updateLeadStatus = updateLeadStatus;

  // Load all data in parallel
  await Promise.all([
    loadOverviewStats(userId),
    initOverviewCharts(userId),
    loadAppointments(userId),
    loadLeads(userId),
    loadUsage(userId),
  ]);
};
