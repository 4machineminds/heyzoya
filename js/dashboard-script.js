// ── OVERVIEW CHARTS ──
window.addEventListener('DOMContentLoaded', () => {

  // Donut: Call Sources
  const donutCanvas = document.getElementById('donutChart');
  if (donutCanvas) {
    new Chart(donutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Organic', 'Referral', 'Direct'],
        datasets: [{
          data: [80, 60, 50],
          backgroundColor: ['#f7d9a1', '#f2b9b8', '#7ab4ff'],
          borderColor: 'transparent',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } },
        },
      },
    });
  }

  // Bar: Leads by Week
  const barCanvas = document.getElementById('barChart');
  if (barCanvas) {
    const ctx = barCanvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Leads',
            data: [12, 18, 30, 45, 38, 52, 70],
            backgroundColor: 'rgba(247,217,161,0.75)',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Appointments',
            data: [5, 10, 15, 20, 17, 25, 30],
            backgroundColor: 'rgba(242,185,184,0.65)',
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { ticks: { color: '#7b8ba5', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#7b8ba5', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }

  // Line: Call Activity
  const lineCanvas = document.getElementById('leadsChart');
  if (lineCanvas) {
    const ctx = lineCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(78,245,138,0.22)');
    grad.addColorStop(1, 'rgba(78,245,138,0)');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan1', 'Jan8', 'Jan15', 'Jan22', 'Jan29', 'Feb5', 'Feb12', 'Feb19', 'Feb26'],
        datasets: [{
          label: 'Calls',
          data: [30, 80, 120, 200, 260, 140, 180, 220, 100],
          borderColor: '#4ef58a',
          backgroundColor: grad,
          fill: true,
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
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

  // Mini appointments table on overview
  const overviewRows = document.getElementById('overviewApptRows');
  if (overviewRows) {
    const appts = JSON.parse(localStorage.getItem('hzAppts') || '[]');
    const recent = appts.slice(0, 4);
    if (recent.length === 0) {
      overviewRows.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px 0;font-size:13px">No appointments yet</td></tr>`;
    } else {
      overviewRows.innerHTML = recent.map(a => {
        const initials = (a.client || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const dt = a.date ? new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
        const badgeClass = a.status === 'confirmed' ? 'badge-confirmed' : a.status === 'pending' ? 'badge-pending' : 'badge-cancelled';
        return `<tr>
          <td style="display:flex;align-items:center;gap:8px">
            <div class="mini-avatar">${initials}</div>
            <span style="font-weight:500;color:#fff">${a.client}</span>
          </td>
          <td style="color:var(--muted)">${dt}</td>
          <td style="color:var(--muted)">${a.type}</td>
          <td><span class="badge ${badgeClass}">${a.status}</span></td>
        </tr>`;
      }).join('');
    }
  }

});
