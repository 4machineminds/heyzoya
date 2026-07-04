// Chart setup for Overview section
const canvas = document.getElementById('leadsChart');
if (canvas) {
  const ctx = canvas.getContext('2d');

  const gradientLeads = ctx.createLinearGradient(0, 0, 0, 200);
  gradientLeads.addColorStop(0, 'rgba(247,217,161,0.5)');
  gradientLeads.addColorStop(1, 'rgba(247,217,161,0)');

  const gradientAppts = ctx.createLinearGradient(0, 0, 0, 200);
  gradientAppts.addColorStop(0, 'rgba(242,185,184,0.5)');
  gradientAppts.addColorStop(1, 'rgba(242,185,184,0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Leads',
          data: [12, 18, 30, 45, 38, 52, 70],
          borderColor: '#f7d9a1',
          backgroundColor: gradientLeads,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f7d9a1',
        },
        {
          label: 'Appointments',
          data: [5, 10, 15, 20, 17, 25, 30],
          borderColor: '#f2b9b8',
          backgroundColor: gradientAppts,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f2b9b8',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#9aabc2' } } },
      scales: {
        x: { ticks: { color: '#7b8ba5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#7b8ba5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  });
}
