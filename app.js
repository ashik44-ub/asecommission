// ==========================================================================
// App State & Configuration
// ==========================================================================
const API_URL = '/api'; // Relative endpoint routing mapped by vercel.json / Express static
let records = [];
let servicePaymentsList = [];
let isOfflineMode = false; // Set to true if MongoDB connection fails

// Charts caching
let overviewChart = null;
let doughnutChart = null;

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initCalculator();
  checkConnectionAndLoad();
  
  // Date Display initialization
  const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

  // Global actions
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
  document.getElementById('search-records-input').addEventListener('input', filterRecords);
});

// ==========================================================================
// Theme Management (Light / Dark)
// ==========================================================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const storedTheme = localStorage.getItem('theme') || 'dark';
  
  document.documentElement.setAttribute('data-theme', storedTheme);
  
  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Refresh charts to match theme styling if they exist
    renderCharts();
  });
}

// ==========================================================================
// Navigation & Tab Management
// ==========================================================================
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const tabSections = document.querySelectorAll('.tab-section');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const headers = {
    overview: { title: "Dashboard Overview", subtitle: "Track and analyze sales collection commissions" },
    calculator: { title: "Commission Calculator", subtitle: "Input values and see real-time calculation summaries" },
    records: { title: "Calculation History", subtitle: "Search, filter, and export persistent records" },
    rules: { title: "Rules & Brackets Reference", subtitle: "Official rates for total collections and service payments" }
  };

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');
      
      // Update sidebar active links
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show the matching section
      tabSections.forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(`${targetTab}-sec`).classList.add('active');

      // Update titles
      pageTitle.textContent = headers[targetTab].title;
      pageSubtitle.textContent = headers[targetTab].subtitle;

      // Handle specific tab actions
      if (targetTab === 'overview') {
        renderCharts();
      }
    });
  });
}

function switchTab(tabId) {
  const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (targetLink) {
    targetLink.click();
  }
}

// ==========================================================================
// Connection Status & Dual-mode Engine Loader
// ==========================================================================
async function checkConnectionAndLoad() {
  const dot = document.getElementById('db-status-dot');
  const text = document.getElementById('db-status-text');

  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    if (data.status === 'ok' && data.database === 'connected') {
      isOfflineMode = false;
      dot.className = 'status-dot connected';
      text.textContent = 'Database Connected';
      fetchCloudRecords();
    } else {
      // API is up, but MongoDB has an issue (e.g. Whitelist error)
      enableOfflineMode('Local Mode (MongoDB Offline)');
    }
  } catch (err) {
    // Backend server is offline or unreachable
    console.error('Server status check failed, running locally:', err);
    enableOfflineMode('Offline Mode (Local Storage)');
  }
}

function enableOfflineMode(statusMsg) {
  isOfflineMode = true;
  const dot = document.getElementById('db-status-dot');
  const text = document.getElementById('db-status-text');
  
  dot.className = 'status-dot';
  text.textContent = statusMsg;
  dot.style.backgroundColor = 'var(--color-yellow)';
  dot.style.boxShadow = '0 0 8px var(--color-yellow)';
  
  loadLocalRecords();
}

// ==========================================================================
// Commission Calculator Business Logic
// ==========================================================================
function calculateCollectionCommission(collection) {
  let rate = 0;
  let bonus = 0;

  if (collection >= 115000 && collection < 150000) {
    rate = 1.75;
    bonus = 750;
  } else if (collection >= 150000 && collection < 200000) {
    rate = 2.00;
    bonus = 1000;
  } else if (collection >= 200000 && collection < 300000) {
    rate = 2.25;
    bonus = 1250;
  } else if (collection >= 300000 && collection < 400000) {
    rate = 2.50;
    bonus = 1500;
  } else if (collection >= 400000 && collection < 500000) {
    rate = 2.75;
    bonus = 1750;
  } else if (collection >= 500000 && collection < 700000) {
    rate = 3.00;
    bonus = 2000;
  } else if (collection >= 700000) {
    rate = 3.25;
    bonus = 2500;
  }

  const commission = (collection * rate) / 100;
  return { rate, commission, bonus };
}

function calculateServiceCommission(payments) {
  let totalServiceComm = 0;
  payments.forEach(val => {
    if (val > 1000 && val <= 3000) {
      totalServiceComm += 150;
    } else if (val > 3000 && val <= 6000) {
      totalServiceComm += 300;
    } else if (val > 6000 && val <= 15000) {
      totalServiceComm += 400;
    } else if (val > 15000) {
      totalServiceComm += 500;
    }
  });
  return totalServiceComm;
}

// ==========================================================================
// UI Calculator Handler
// ==========================================================================
function initCalculator() {
  const totalCollInput = document.getElementById('total-collection-input');
  const serviceInput = document.getElementById('service-payment-amount');
  const btnAddService = document.getElementById('btn-add-payment');
  const tagsContainer = document.getElementById('payments-tags-container');
  const repNameInput = document.getElementById('rep-name');
  const periodSelect = document.getElementById('period-select');
  const btnReset = document.getElementById('btn-reset-form');
  const calculatorForm = document.getElementById('commission-form');
  const btnPrintSlip = document.getElementById('btn-print-slip');

  // Trigger calculation update on keyboard entry
  totalCollInput.addEventListener('input', updateRealTimeInvoice);
  
  repNameInput.addEventListener('input', () => {
    document.getElementById('invoice-rep-name').textContent = repNameInput.value || 'N/A';
  });

  periodSelect.addEventListener('change', () => {
    document.getElementById('invoice-period').textContent = periodSelect.value || 'N/A';
  });

  // Adding individual service payments
  btnAddService.addEventListener('click', () => {
    const val = parseFloat(serviceInput.value);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    
    servicePaymentsList.push(val);
    serviceInput.value = '';
    serviceInput.focus();
    
    renderServiceTags();
    updateRealTimeInvoice();
  });

  serviceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddService.click();
    }
  });

  // Reset form handler
  btnReset.addEventListener('click', () => {
    calculatorForm.reset();
    servicePaymentsList = [];
    renderServiceTags();
    updateRealTimeInvoice();
    document.getElementById('invoice-rep-name').textContent = 'N/A';
    document.getElementById('invoice-period').textContent = periodSelect.value || 'May 2026';
  });

  // Submit and save record
  calculatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const repName = repNameInput.value.trim();
    const period = periodSelect.value;
    const totalCollection = parseFloat(totalCollInput.value) || 0;

    if (!repName || !period) {
      showToast('Please fill out name and period fields', 'error');
      return;
    }

    const recordData = {
      repName,
      period,
      totalCollection,
      servicePayments: servicePaymentsList
    };

    if (isOfflineMode) {
      // Local calculation and saving
      saveLocalRecord(recordData);
    } else {
      // Server saving
      try {
        const res = await fetch(`${API_URL}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordData)
        });

        if (!res.ok) {
          throw new Error('Database connection failed. Falling back to local storage.');
        }

        const saved = await res.json();
        showToast(`Record synced to MongoDB Atlas for ${saved.repName}!`, 'success');
        btnReset.click();
        fetchCloudRecords();
      } catch (err) {
        console.warn('DB Save failed, saving locally:', err);
        showToast('Atlas DB disconnected. Record saved to local browser storage!', 'info');
        saveLocalRecord(recordData);
        enableOfflineMode('Local Mode (MongoDB Offline)');
      }
    }
  });

  // Print slip triggers modal
  btnPrintSlip.addEventListener('click', () => {
    const repName = repNameInput.value.trim() || 'Unspecified Sales Rep';
    const period = periodSelect.value || 'May 2026';
    const totalCollection = parseFloat(totalCollInput.value) || 0;

    const collResult = calculateCollectionCommission(totalCollection);
    const serviceComm = calculateServiceCommission(servicePaymentsList);
    const grandTotal = collResult.commission + collResult.bonus + serviceComm;

    const modalBody = document.getElementById('printable-slip-area');
    
    let serviceBreakdownHTML = '';
    if (servicePaymentsList.length > 0) {
      serviceBreakdownHTML = servicePaymentsList.map((val, idx) => {
        let comm = 0;
        if (val > 1000 && val <= 3000) comm = 150;
        else if (val > 3000 && val <= 6000) comm = 300;
        else if (val > 6000 && val <= 15000) comm = 400;
        else if (val > 15000) comm = 500;
        return `<div class="slip-row text-muted">
                  <span>Tx #${idx + 1}: ${formatTk(val)}</span>
                  <span>+ ${formatTk(comm)}</span>
                </div>`;
      }).join('');
    } else {
      serviceBreakdownHTML = `<div class="slip-row text-muted"><span>No service payments listed</span><span>Tk. 0</span></div>`;
    }

    modalBody.innerHTML = `
      <div class="slip-print-box">
        <h2 class="slip-title">COMMISSYNC REPORT SLIP</h2>
        <div class="slip-subtitle">Date Generated: ${new Date().toLocaleString()}</div>
        
        <div class="slip-divider"></div>
        
        <div class="slip-row">
          <strong>Representative:</strong>
          <span>${repName}</span>
        </div>
        <div class="slip-row">
          <strong>Billing Period:</strong>
          <span>${period}</span>
        </div>

        <div class="slip-divider"></div>

        <h4 style="margin-bottom: 0.5rem; font-size: 0.85rem; text-transform: uppercase;">1. Collection Commission</h4>
        <div class="slip-row">
          <span>Total Collection Base</span>
          <span>${formatTk(totalCollection)}</span>
        </div>
        <div class="slip-row">
          <span>Bracket Rate Applied</span>
          <span>${collResult.rate.toFixed(2)}%</span>
        </div>
        <div class="slip-row text-blue font-semibold">
          <span>Collection Comm. Earned</span>
          <span>${formatTk(collResult.commission)}</span>
        </div>
        <div class="slip-row text-green font-semibold">
          <span>Milestone Cash Bonus</span>
          <span>${formatTk(collResult.bonus)}</span>
        </div>

        <div class="slip-divider"></div>

        <h4 style="margin-bottom: 0.5rem; font-size: 0.85rem; text-transform: uppercase;">2. Service & TDS/VDS Payments</h4>
        <div class="slip-row">
          <span>Total Payments Collected</span>
          <span>${servicePaymentsList.length} items</span>
        </div>
        ${serviceBreakdownHTML}
        <div class="slip-row text-purple font-semibold" style="margin-top: 0.25rem;">
          <span>Service Comm. Subtotal</span>
          <span>${formatTk(serviceComm)}</span>
        </div>

        <div class="slip-divider" style="border-top-style: solid; border-top-width: 2px;"></div>

        <div class="slip-grand-total">
          <span>GRAND TOTAL PAYOUT</span>
          <span>${formatTk(grandTotal)}</span>
        </div>
      </div>
    `;

    openPrintModal();
  });
}

function renderServiceTags() {
  const container = document.getElementById('payments-tags-container');
  const countBadge = document.getElementById('service-count-badge');
  
  countBadge.textContent = `${servicePaymentsList.length} Transaction${servicePaymentsList.length === 1 ? '' : 's'}`;

  if (servicePaymentsList.length === 0) {
    container.innerHTML = '<div class="no-payments-placeholder">No service collections added yet.</div>';
    return;
  }

  container.innerHTML = '';
  servicePaymentsList.forEach((amount, index) => {
    const tag = document.createElement('div');
    tag.className = 'payment-tag';
    tag.innerHTML = `
      <span>${formatTk(amount)}</span>
      <button type="button" class="btn-remove-tag" onclick="removeServicePayment(${index})" aria-label="Remove">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    container.appendChild(tag);
  });
}

function removeServicePayment(index) {
  servicePaymentsList.splice(index, 1);
  renderServiceTags();
  updateRealTimeInvoice();
}

function updateRealTimeInvoice() {
  const totalCollInput = document.getElementById('total-collection-input');
  const totalCollection = parseFloat(totalCollInput.value) || 0;

  // Perform computations
  const collResult = calculateCollectionCommission(totalCollection);
  const serviceComm = calculateServiceCommission(servicePaymentsList);
  const grandTotal = collResult.commission + collResult.bonus + serviceComm;

  // Update summary DOM nodes
  document.getElementById('rec-total-collection').textContent = formatTk(totalCollection);
  document.getElementById('rec-tier-rate').textContent = `${collResult.rate.toFixed(2)}%`;
  document.getElementById('rec-collection-comm').textContent = formatTk(collResult.commission);
  document.getElementById('rec-collection-bonus').textContent = formatTk(collResult.bonus);
  
  document.getElementById('rec-service-count').textContent = `${servicePaymentsList.length} item${servicePaymentsList.length === 1 ? '' : 's'}`;
  document.getElementById('rec-service-comm').textContent = formatTk(serviceComm);
  
  document.getElementById('rec-grand-total').textContent = formatTk(grandTotal);
}

// ==========================================================================
// Database & LocalStorage Dual Loader System
// ==========================================================================
async function fetchCloudRecords() {
  try {
    const res = await fetch(`${API_URL}/records`);
    if (!res.ok) throw new Error('Database server selection issue');
    records = await res.json();
    
    // Sync local records array with fetched
    localStorage.setItem('commission_records_cache', JSON.stringify(records));
    
    renderAppComponents();
  } catch (err) {
    console.warn('Fetch failed, switching to local state cache:', err);
    enableOfflineMode('Local Mode (MongoDB Offline)');
  }
}

function loadLocalRecords() {
  try {
    const raw = localStorage.getItem('commission_records');
    records = raw ? JSON.parse(raw) : [];
    renderAppComponents();
    showToast('Loaded records from browser local storage', 'info');
  } catch (err) {
    console.error('LocalStorage parse error:', err);
    records = [];
  }
}

function saveLocalRecord(recordInput) {
  const collResult = calculateCollectionCommission(recordInput.totalCollection);
  const serviceComm = calculateServiceCommission(recordInput.servicePayments);
  const grandTotal = collResult.commission + collResult.bonus + serviceComm;

  const fullRecord = {
    _id: 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    repName: recordInput.repName,
    period: recordInput.period,
    totalCollection: recordInput.totalCollection,
    collectionRate: collResult.rate,
    collectionCommission: collResult.commission,
    collectionBonus: collResult.bonus,
    servicePayments: recordInput.servicePayments,
    serviceCommission: serviceComm,
    grandTotal: grandTotal,
    createdAt: new Date().toISOString()
  };

  records.unshift(fullRecord);
  localStorage.setItem('commission_records', JSON.stringify(records));
  
  showToast(`Record saved locally for ${fullRecord.repName}!`, 'success');
  
  // Clear calculator inputs
  document.getElementById('btn-reset-form').click();
  renderAppComponents();
}

async function deleteRecord(id, repName) {
  if (!confirm(`Are you sure you want to delete the commission record for ${repName}?`)) {
    return;
  }

  if (id.startsWith('local_') || isOfflineMode) {
    records = records.filter(r => r._id !== id);
    localStorage.setItem('commission_records', JSON.stringify(records));
    showToast('Local record deleted', 'success');
    renderAppComponents();
  } else {
    try {
      const res = await fetch(`${API_URL}/records/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Cloud delete failed');
      
      showToast('Record deleted from MongoDB', 'success');
      fetchCloudRecords();
    } catch (err) {
      console.warn('Server delete failed, deleting local cached copy:', err);
      // Remove from memory
      records = records.filter(r => r._id !== id);
      showToast('Deleted cached record copy', 'success');
      renderAppComponents();
    }
  }
}

function renderAppComponents() {
  populateOverviewStats();
  populateRecordsTable();
  populateRecentRecordsTable();
  renderCharts();
}

// ==========================================================================
// DOM Render Helper functions
// ==========================================================================
function populateOverviewStats() {
  const totalColl = records.reduce((sum, r) => sum + r.totalCollection, 0);
  const totalComm = records.reduce((sum, r) => sum + (r.collectionCommission || 0) + (r.serviceCommission || 0), 0);
  const totalBonus = records.reduce((sum, r) => sum + (r.collectionBonus || 0), 0);
  const grandTotal = records.reduce((sum, r) => sum + (r.grandTotal || 0), 0);

  document.getElementById('stat-total-collection').textContent = formatTk(totalColl);
  document.getElementById('stat-total-commission').textContent = formatTk(totalComm);
  document.getElementById('stat-total-bonus').textContent = formatTk(totalBonus);
  document.getElementById('stat-grand-total').textContent = formatTk(grandTotal);
}

function populateRecentRecordsTable() {
  const tbody = document.getElementById('recent-records-tbody');
  tbody.innerHTML = '';
  
  const recents = records.slice(0, 5);
  
  if (recents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No records found. Calculate first!</td></tr>`;
    return;
  }

  recents.forEach(r => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHTML(r.repName)}</strong></td>
      <td>${escapeHTML(r.period)}</td>
      <td>${formatTk(r.totalCollection)}</td>
      <td>${formatTk(r.serviceCommission)}</td>
      <td class="text-green font-semibold">${formatTk(r.grandTotal)}</td>
      <td class="text-muted">${new Date(r.createdAt).toLocaleDateString()}</td>
    `;
    tbody.appendChild(row);
  });
}

function populateRecordsTable() {
  const tbody = document.getElementById('all-records-tbody');
  tbody.innerHTML = '';
  
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No historical calculations found.</td></tr>`;
    document.getElementById('pagination-info').textContent = 'Showing 0 of 0 entries';
    return;
  }

  records.forEach(r => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHTML(r.repName)}</strong></td>
      <td>${escapeHTML(r.period)}</td>
      <td class="text-right">${formatTk(r.totalCollection)}</td>
      <td class="text-right">${(r.collectionRate || 0).toFixed(2)}%</td>
      <td class="text-right text-blue">${formatTk(r.collectionCommission || 0)}</td>
      <td class="text-right text-yellow">${formatTk(r.collectionBonus || 0)}</td>
      <td class="text-right text-purple">${formatTk(r.serviceCommission || 0)}</td>
      <td class="text-right text-green font-semibold">${formatTk(r.grandTotal || 0)}</td>
      <td class="text-muted">${new Date(r.createdAt).toLocaleDateString()}</td>
      <td class="text-center">
        <button class="btn-delete" onclick="deleteRecord('${r._id}', '${escapeHTML(r.repName)}')" aria-label="Delete">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('pagination-info').textContent = `Showing 1 to ${records.length} of ${records.length} entries`;
}

// Search and local filtering
function filterRecords() {
  const query = document.getElementById('search-records-input').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#all-records-tbody tr');

  if (rows.length === 0 || records.length === 0) return;

  let visibleCount = 0;

  rows.forEach(row => {
    const textContent = row.textContent.toLowerCase();
    if (textContent.includes(query)) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  document.getElementById('pagination-info').textContent = `Showing ${visibleCount} of ${records.length} entries`;
}

// ==========================================================================
// Chart.js Visualizations
// ==========================================================================
function renderCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#9ca3af' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Destroy previous instances to avoid memory leaks or canvas overlapping
  if (overviewChart) overviewChart.destroy();
  if (doughnutChart) doughnutChart.destroy();

  // If no records exist, load placeholder charts
  const hasRecords = records.length > 0;
  
  // Overview Chart (Bar representation)
  const overviewCtx = document.getElementById('overview-chart').getContext('2d');
  
  const chartLabels = hasRecords 
    ? records.slice(0, 8).reverse().map(r => `${r.repName} (${r.period})`)
    : ['Example Rep 1', 'Example Rep 2', 'Example Rep 3'];
    
  const collectionData = hasRecords 
    ? records.slice(0, 8).reverse().map(r => r.totalCollection)
    : [200000, 450000, 320000];
    
  const commissionData = hasRecords 
    ? records.slice(0, 8).reverse().map(r => r.grandTotal)
    : [5750, 14125, 9700];

  overviewChart = new Chart(overviewCtx, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: 'Total Collections (Tk.)',
          data: collectionData,
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          yAxisID: 'yCollection'
        },
        {
          label: 'Total Commission Earned (Tk.)',
          data: commissionData,
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          yAxisID: 'yCommission'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Inter', weight: '500' } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        yCollection: {
          type: 'linear',
          position: 'left',
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (val) => 'Tk. ' + (val / 1000) + 'k'
          },
          title: { display: true, text: 'Collections Scale', color: textColor }
        },
        yCommission: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: {
            color: textColor,
            callback: (val) => 'Tk. ' + val.toLocaleString()
          },
          title: { display: true, text: 'Commission Scale', color: textColor }
        }
      }
    }
  });

  // Doughnut Chart (Breakdown)
  const doughnutCtx = document.getElementById('doughnut-chart').getContext('2d');
  
  let collectionCommSum = records.reduce((sum, r) => sum + (r.collectionCommission || 0), 0);
  let bonusCommSum = records.reduce((sum, r) => sum + (r.collectionBonus || 0), 0);
  let serviceCommSum = records.reduce((sum, r) => sum + (r.serviceCommission || 0), 0);
  
  if (!hasRecords) {
    collectionCommSum = 10000;
    bonusCommSum = 3000;
    serviceCommSum = 4500;
  }

  doughnutChart = new Chart(doughnutCtx, {
    type: 'doughnut',
    data: {
      labels: ['Base Collection Comm.', 'Milestone Bonuses', 'Service Payments Comm.'],
      datasets: [{
        data: [collectionCommSum, bonusCommSum, serviceCommSum],
        backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6'],
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? '#111827' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, padding: 15, font: { family: 'Inter', size: 11 } }
        }
      },
      cutout: '65%'
    }
  });
}

// ==========================================================================
// Document Export / Download Functionality
// ==========================================================================
function exportToCSV() {
  if (records.length === 0) {
    showToast('No records available to export', 'error');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Representative Name,Period,Total Collection,Collection Rate %,Collection Commission,Milestone Cash Bonus,Service Commission,Grand Total Payout,Calculation Date\n";

  records.forEach(r => {
    const row = [
      `"${r.repName.replace(/"/g, '""')}"`,
      `"${r.period}"`,
      r.totalCollection,
      `${(r.collectionRate || 0)}%`,
      r.collectionCommission || 0,
      r.collectionBonus || 0,
      r.serviceCommission || 0,
      r.grandTotal || 0,
      new Date(r.createdAt).toISOString().split('T')[0]
    ];
    csvContent += row.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `commissions_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('CSV export downloaded!', 'success');
}

// ==========================================================================
// Modal Operations
// ==========================================================================
function openPrintModal() {
  const modal = document.getElementById('print-modal');
  modal.classList.add('open');
  
  // Event listeners for close
  document.getElementById('btn-close-print-modal').addEventListener('click', closePrintModal);
  document.getElementById('btn-close-modal-cancel').addEventListener('click', closePrintModal);
  document.getElementById('btn-trigger-print').addEventListener('click', () => {
    window.print();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePrintModal();
  });
}

function closePrintModal() {
  document.getElementById('print-modal').classList.remove('open');
}

// ==========================================================================
// Notification Toaster
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('notification-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  else if (type === 'error') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  // Slide out and remove toast after 4s
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

// ==========================================================================
// Formatter & Security Escaping Helpers
// ==========================================================================
function formatTk(num) {
  return 'Tk. ' + Math.round(num).toLocaleString('en-IN');
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
