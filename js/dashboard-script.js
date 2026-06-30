// ✅ Load Chart.js
// Make sure this line is in your HTML before this script:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

// ========================
// Chart Data and Setup (for Overview page)
// ========================
const canvas = document.getElementById('leadsChart');
if (canvas) {
  const leadsPerDay = [12, 18, 30, 45, 38, 52, 70];
  const appointmentsPerDay = [5, 10, 15, 20, 17, 25, 30];

  const ctx = canvas.getContext('2d');
  const gradientLeads = ctx.createLinearGradient(0, 0, 0, 200);
  gradientLeads.addColorStop(0, 'rgba(247,217,161,0.5)');
  gradientLeads.addColorStop(1, 'rgba(247,217,161,0)');
  const gradientAppointments = ctx.createLinearGradient(0, 0, 0, 200);
  gradientAppointments.addColorStop(0, 'rgba(242,185,184,0.5)');
  gradientAppointments.addColorStop(1, 'rgba(242,185,184,0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Leads',
          data: leadsPerDay,
          borderColor: '#f7d9a1',
          backgroundColor: gradientLeads,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f7d9a1',
        },
        {
          label: 'Appointments',
          data: appointmentsPerDay,
          borderColor: '#f2b9b8',
          backgroundColor: gradientAppointments,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f2b9b8',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#fff' } } },
      scales: {
        x: {
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
    },
  });
}

// ========================
// Authentication Check
// ========================
const loggedInEmail = localStorage.getItem('loggedInUser');
if (!loggedInEmail) window.location.replace('login.html');

document.addEventListener('DOMContentLoaded', () => {
  const userData = JSON.parse(localStorage.getItem(loggedInEmail)) || {};
  document.getElementById('userName').textContent = userData.name || 'User';
  document.getElementById('businessName').textContent =
    userData.businessName || 'My Business';

  // Logout functionality
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('loggedInUser');
    window.location.href = 'login.html';
  });
});

// ========================
// Mobile Sidebar Toggle
// ========================
function toggleMenu() {
  const sidebar = document.querySelector('.sidebar-left');
  sidebar.classList.toggle('active');
  document.body.classList.toggle('sidebar-open');
}
