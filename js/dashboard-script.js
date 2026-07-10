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
  const since7  = new Date(Date.now() -  7 * 86400000).toISOString();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [{ data: calls7 }, { data: calls14 }, { data: leads7 }] = await Promise.all([
    _supabase.from('calls').select('started_at, status').eq('user_id', userId).gte('started_at', since7).order('started_at'),
    _supabase.from('calls').select('started_at').eq('user_id', userId).gte('started_at', since14).lt('started_at', since7),
    _supabase.from('leads').select('created_at').eq('user_id', userId).gte('created_at', since7),
  ]);

  const allCalls7 = calls7 || [];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Daily buckets (Mon=0 … Sun=6)
  const callsByDay = Array(7).fill(0);
  allCalls7.forEach(c => { callsByDay[(new Date(c.started_at).getDay() + 6) % 7]++; });

  const leadsByDay = Array(7).fill(0);
  (leads7 || []).forEach(l => { leadsByDay[(new Date(l.created_at).getDay() + 6) % 7]++; });

  // ── Populate chart header values ──
  const totalCalls7  = allCalls7.length;
  const totalCalls14 = (calls14 || []).length;
  const totalLeads7  = (leads7 || []).length;

  const el = id => document.getElementById(id);

  if (el('donutCenterVal')) el('donutCenterVal').textContent = totalCalls7;
  if (el('chartValCalls'))  el('chartValCalls').textContent  = totalCalls7 + ' calls this week';
  if (el('chartValLeads'))  el('chartValLeads').textContent  = totalLeads7 + ' leads this week';

  // Call Activity: total + % vs prev week
  const actPct = totalCalls14 > 0
    ? Math.round(((totalCalls7 - totalCalls14) / totalCalls14) * 100)
    : null;
  const actBadge = actPct === null
    ? ''
    : `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(78,245,138,0.12);color:var(--success);vertical-align:middle">${actPct >= 0 ? '↑' : '↓'} ${Math.abs(actPct)}%</span>`;
  if (el('chartValActivity')) el('chartValActivity').innerHTML = `${totalCalls7} ${actBadge}`;

  // ── Donut: real call status breakdown ──
  const ended     = allCalls7.filter(c => c.status === 'ended').length;
  const failed    = allCalls7.filter(c => c.status === 'failed').length;
  const inProg    = allCalls7.filter(c => c.status === 'in-progress').length;
  const pct = n => totalCalls7 > 0 ? Math.round((n / totalCalls7) * 100) + '%' : '0%';
  if (el('donutPctEnded'))  el('donutPctEnded').textContent  = pct(ended);
  if (el('donutPctFailed')) el('donutPctFailed').textContent = pct(failed);
  if (el('donutPctActive')) el('donutPctActive').textContent = pct(inProg);

  const donutCanvas = document.getElementById('donutChart');
  if (donutCanvas) {
    new Chart(donutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Failed', 'In Progress'],
        datasets: [{ data: [ended || 1, failed, inProg], backgroundColor: ['#4ef58a','#f2b9b8','#7ab4ff'], borderColor: 'transparent', hoverOffset: 6 }],
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
function pctBadge(el, current, prev) {
  if (!el) return;
  if (!prev && !current) { el.textContent = '—'; el.className = 'stat-badge'; return; }
  if (!prev) { el.textContent = '↑ New'; el.className = 'stat-badge up'; return; }
  const pct = Math.round(((current - prev) / prev) * 100);
  el.textContent = pct >= 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
  el.className = 'stat-badge ' + (pct >= 0 ? 'up' : 'down');
}

async function loadOverviewStats(userId) {
  const now = new Date();
  const thisWeekStart = new Date(now - 7 * 86400000).toISOString();
  const lastWeekStart = new Date(now - 14 * 86400000).toISOString();

  const [
    { count: leadCount },
    { count: apptCount },
    { count: callCount },
    { count: activeCount },
    { count: leadsTW },
    { count: apptsTW },
    { count: callsTW },
    { count: activeTW },
    { count: leadsLW },
    { count: apptsLW },
    { count: callsLW },
    { count: activeLW },
  ] = await Promise.all([
    // All-time totals
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    _supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    _supabase.from('calls').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['new', 'contacted']),
    // This week
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', thisWeekStart),
    _supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', thisWeekStart),
    _supabase.from('calls').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('started_at', thisWeekStart),
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['new', 'contacted']).gte('created_at', thisWeekStart),
    // Last week
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', lastWeekStart).lt('created_at', thisWeekStart),
    _supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', lastWeekStart).lt('created_at', thisWeekStart),
    _supabase.from('calls').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('started_at', lastWeekStart).lt('started_at', thisWeekStart),
    _supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['new', 'contacted']).gte('created_at', lastWeekStart).lt('created_at', thisWeekStart),
  ]);

  const el = id => document.getElementById(id);
  if (el('statLeads'))  el('statLeads').textContent  = leadCount  ?? 0;
  if (el('statAppts'))  el('statAppts').textContent  = apptCount  ?? 0;
  if (el('statCalls'))  el('statCalls').textContent  = callCount  ?? 0;
  if (el('statActive')) el('statActive').textContent = activeCount ?? 0;

  pctBadge(el('sfLeads'),  leadsTW  ?? 0, leadsLW  ?? 0);
  pctBadge(el('sfAppts'),  apptsTW  ?? 0, apptsLW  ?? 0);
  pctBadge(el('sfCalls'),  callsTW  ?? 0, callsLW  ?? 0);
  pctBadge(el('sfActive'), activeTW ?? 0, activeLW ?? 0);

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
    const dt = a.appt_date
      ? fmtDate(a.appt_date + 'T00:00:00')
      : '<span style="font-size:11px;color:var(--muted);font-style:italic">Unscheduled</span>';
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
  const [{ data: leads, error }, { data: allCalls }] = await Promise.all([
    _supabase.from('leads').select('*, calls(duration_seconds, started_at)').eq('user_id', userId).order('created_at', { ascending: false }),
    _supabase.from('calls').select('caller_number, started_at').eq('user_id', userId).not('caller_number', 'is', null),
  ]);

  const container = document.getElementById('leadsContainer');
  const repeatContainer = document.getElementById('repeatCallersContainer');

  // ── Repeat callers: group calls by caller_number, find count > 1 ──
  if (repeatContainer) {
    const callMap = {};
    (allCalls || []).forEach(c => {
      if (!c.caller_number) return;
      callMap[c.caller_number] = (callMap[c.caller_number] || 0) + 1;
    });
    const repeats = Object.entries(callMap).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

    if (repeats.length > 0) {
      // Match to lead records for names
      const leadsByPhone = {};
      (leads || []).forEach(l => { if (l.phone) leadsByPhone[l.phone] = l; });

      repeatContainer.innerHTML = `
        <div class="repeat-callers-header">
          <h3>Repeat Callers</h3>
          <span class="repeat-badge">Hot Leads</span>
        </div>
        <div class="repeat-list">
          ${repeats.map(([phone, count]) => {
            const lead = leadsByPhone[phone];
            const name = lead?.name || 'Unknown Caller';
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return `<div class="repeat-card">
              <div class="repeat-avatar">${initials}</div>
              <div class="repeat-info">
                <div class="repeat-name">${name}</div>
                <div class="repeat-phone">${phone}</div>
              </div>
              <span class="repeat-count">${count} calls</span>
            </div>`;
          }).join('')}
        </div>`;
    } else {
      repeatContainer.innerHTML = '';
    }
  }

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
          const callArr = Array.isArray(l.calls) ? l.calls[0] : l.calls;
          return `<tr>
            <td><div class="appt-name">${l.name || '—'}</div></td>
            <td>${l.phone || '—'}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.intent || '—'}</td>
            <td><span class="badge ${badge}">${l.status}</span></td>
            <td>${fmtDuration(callArr?.duration_seconds)}</td>
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
// CALLS SECTION — real data from Supabase
// ─────────────────────────────────────────────────────────────────────────────
async function loadCalls(userId) {
  const { data: calls, error } = await _supabase
    .from('calls')
    .select('*, leads(name, phone)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(50);

  const container = document.getElementById('callsContainer');
  if (!container) return;

  const list = (!error && calls) ? calls : [];

  // Update mini stats
  const totalSecs  = list.reduce((s, c) => s + (c.duration_seconds || 0), 0);
  const completed  = list.filter(c => c.status === 'ended').length;
  const totalMins  = Math.floor(totalSecs / 60);
  const totalSec2  = totalSecs % 60;
  const durStr     = totalMins ? `${totalMins}m ${totalSec2}s` : `${totalSecs}s`;

  const elTotal    = document.getElementById('cStatTotal');
  const elDuration = document.getElementById('cStatDuration');
  const elEnded    = document.getElementById('cStatEnded');
  if (elTotal)    elTotal.textContent    = list.length;
  if (elDuration) elDuration.textContent = list.length ? durStr : '0m';
  if (elEnded)    elEnded.textContent    = completed;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="calls-empty">
        <div class="calls-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <h3>No calls yet</h3>
        <p>Once Zoya starts answering calls, each one will appear here with a full summary, recording, and caller details.</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="calls-list">${list.map(c => {
    const lead        = Array.isArray(c.leads) ? c.leads[0] : c.leads;
    const callerName  = lead?.name  || 'Unknown Caller';
    const callerPhone = lead?.phone || c.caller_number || '—';
    const initials    = callerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const statusClass = c.status === 'ended' ? 'status-ended'
                      : c.status === 'in-progress' ? 'status-in-progress' : 'status-failed';
    const statusColor = c.status === 'ended' ? 'var(--success)'
                      : c.status === 'in-progress' ? 'var(--accent2)' : 'var(--danger)';
    const dur         = fmtDuration(c.duration_seconds);
    const dt          = fmtDate(c.started_at);
    const summary     = c.summary || '';
    const recording   = c.recording_url;

    return `<div class="call-card ${statusClass}">
      <div class="call-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <div class="call-body">
        <div class="call-name">${callerName}</div>
        <div class="call-phone">${callerPhone}</div>
        ${summary ? `<div class="call-summary">${summary}</div>` : ''}
      </div>
      <div class="call-meta">
        <div class="call-duration">${dur}</div>
        <div class="call-date">${dt}</div>
        <span class="call-status-badge" style="color:${statusColor}">${c.status || '—'}</span>
        ${recording
          ? `<button class="call-play" onclick="toggleCallAudio(this,'${recording}')">
               <svg class="play-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
               <svg class="pause-icon" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
               <span>Play</span>
             </button>`
          : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

window.refreshCalls = async function() {
  const btn = document.getElementById('callsRefreshBtn');
  if (btn) btn.classList.add('spinning');
  await loadCalls(window._currentUserId);
  if (btn) { btn.classList.remove('spinning'); showToast('Calls refreshed!'); }
};

// Inline audio player — toggles play/pause inside the card
window.toggleCallAudio = function(btn, url) {
  const card = btn.closest('.call-card');
  let player = card.querySelector('.call-audio-player');

  if (!player) {
    player = document.createElement('div');
    player.className = 'call-audio-player';
    player.innerHTML = `<audio controls preload="none" style="width:100%;height:36px;outline:none" src="${url}"></audio>`;
    card.appendChild(player);
  }

  const audio = player.querySelector('audio');
  const playIcon  = btn.querySelector('.play-icon');
  const pauseIcon = btn.querySelector('.pause-icon');
  const label     = btn.querySelector('span');

  if (audio.paused) {
    // Pause any other playing audio first
    document.querySelectorAll('.call-audio-player audio').forEach(a => {
      if (a !== audio) {
        a.pause();
        const otherBtn = a.closest('.call-card').querySelector('.call-play');
        if (otherBtn) {
          otherBtn.querySelector('.play-icon').style.display  = '';
          otherBtn.querySelector('.pause-icon').style.display = 'none';
          otherBtn.querySelector('span').textContent = 'Play';
        }
      }
    });
    audio.play();
    playIcon.style.display  = 'none';
    pauseIcon.style.display = '';
    label.textContent = 'Pause';
    audio.onended = () => {
      playIcon.style.display  = '';
      pauseIcon.style.display = 'none';
      label.textContent = 'Play';
    };
  } else {
    audio.pause();
    playIcon.style.display  = '';
    pauseIcon.style.display = 'none';
    label.textContent = 'Play';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// USAGE — load from Supabase for account section
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  essential: { name: 'Essential', price: 49,  minutes: 80 },
  pro:       { name: 'Pro',       price: 125, minutes: 250 },
  plus:      { name: 'Plus',      price: 299, minutes: 700 },
};

async function loadUsage(userId) {
  const month = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Force a session refresh so we always get the latest user_metadata (plan may have been changed by admin)
  const [{ data: usage }, refreshResult] = await Promise.all([
    _supabase.from('usage_monthly').select('*').eq('user_id', userId).eq('month', month).single(),
    _supabase.auth.refreshSession(),
  ]);
  const user = refreshResult?.data?.session?.user || refreshResult?.data?.user || null;

  const el = id => document.getElementById(id);

  const planKey = user?.user_metadata?.plan || '';
  const plan    = PLAN_CONFIG[planKey];

  if (el('planMonth')) el('planMonth').textContent = monthLabel;

  if (!plan) {
    if (el('planBadgeText')) el('planBadgeText').textContent = 'No plan assigned';
    if (el('planName'))      el('planName').textContent      = 'Not assigned';
    if (el('planPrice'))     el('planPrice').textContent     = '—';
    if (el('planMinutes'))   el('planMinutes').textContent   = '—';
    if (el('planOverageNote')) el('planOverageNote').textContent = 'Contact your administrator to assign a plan.';
    if (el('profilePlanBadge')) el('profilePlanBadge').textContent = '✦ No Plan';
    if (el('minsUsed'))         el('minsUsed').textContent         = '—';
    if (el('minsUsedFill'))     el('minsUsedFill').style.width     = '0%';
    if (el('minsRemainingNote')) el('minsRemainingNote').textContent = 'No plan assigned yet.';
    return;
  }

  const minsUsed      = parseFloat(usage?.total_minutes || 0);
  const callsCount    = usage?.total_calls || 0;
  const minsRemaining = Math.max(0, plan.minutes - minsUsed);
  const pct           = Math.min(100, (minsUsed / plan.minutes) * 100);
  const overLimit     = minsUsed > plan.minutes;

  if (el('planBadgeText'))    el('planBadgeText').textContent    = `${plan.name} Plan — Active`;
  if (el('planName'))         el('planName').textContent         = plan.name;
  if (el('planPrice'))        el('planPrice').textContent        = `$${plan.price}/month`;
  if (el('planMinutes'))      el('planMinutes').textContent      = `${plan.minutes} min`;
  if (el('planCalls'))        el('planCalls').textContent        = `${callsCount} calls`;
  if (el('planUsed'))         el('planUsed').textContent         = `${minsUsed.toFixed(1)} min`;
  if (el('planRemaining'))  {
    el('planRemaining').textContent = overLimit ? 'Over limit' : `${minsRemaining.toFixed(1)} min`;
    el('planRemaining').style.color = overLimit ? 'var(--danger)' : 'var(--success)';
  }
  if (el('planProgressBar')) {
    el('planProgressBar').style.width = pct + '%';
    el('planProgressBar').style.background = overLimit
      ? 'linear-gradient(90deg,#f87171,#f97316)'
      : 'linear-gradient(90deg,#4ef58a,#7ab4ff)';
  }
  if (el('planOverageNote')) {
    el('planOverageNote').textContent = overLimit
      ? `You've used ${(minsUsed - plan.minutes).toFixed(1)} min over your ${plan.minutes}-min limit. Contact your administrator.`
      : `${pct.toFixed(0)}% of your monthly minutes used.`;
  }

  // Profile card (Account section sidebar)
  if (el('profilePlanBadge')) el('profilePlanBadge').textContent = `✦ ${plan.name} Plan`;
  if (el('minsUsed'))         el('minsUsed').textContent         = `${minsUsed.toFixed(1)} / ${plan.minutes}`;
  if (el('minsUsedFill'))     el('minsUsedFill').style.width     = pct + '%';
  if (el('minsRemainingNote')) {
    el('minsRemainingNote').textContent = overLimit
      ? 'Monthly limit exceeded'
      : `${minsRemaining.toFixed(1)} minutes remaining this month`;
  }
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
  window.refreshPlanUsage = () => loadUsage(userId);

  // Load all data in parallel
  await Promise.all([
    loadOverviewStats(userId),
    initOverviewCharts(userId),
    loadAppointments(userId),
    loadLeads(userId),
    loadCalls(userId),
    loadUsage(userId),
  ]);
};
