function recalcRow(row) {
  const days = row.querySelectorAll('.day-input');
  const total = Array.from(days).reduce((s, i) => s + (parseInt(i.value) || 0), 0);
  row.querySelector('.total-input').value = total;
}

// Auto-update totals
document.querySelectorAll('.day-input').forEach(inp =>
  inp.addEventListener('input', e => recalcRow(e.target.closest('tr')))
);

document.querySelectorAll('.total-input').forEach(inp =>
  inp.addEventListener('input', () => {
    const row = inp.closest('tr');
    const total = parseInt(inp.value) || 0;
    const days = Array.from(row.querySelectorAll('.day-input'));
    if (!days.length) return;
    if (total === 0) days.forEach(d => d.value = 0);
    else {
      const base = Math.floor(total / days.length);
      let rem = total % days.length;
      days.forEach(d => { d.value = base + (rem-- > 0 ? 1 : 0); });
    }
  })
);

// Add expiry batches
document.querySelectorAll('.add-expiry').forEach(btn =>
  btn.addEventListener('click', () => {
    const row = btn.closest('tr');
    const list = row.querySelector('.expiry-list');
    const div = document.createElement('div');
    div.className = 'expiry-item';

    const stock = document.createElement('input');
    stock.type = 'number';
    stock.placeholder = 'Qty';

    const exp = document.createElement('input');
    exp.type = 'date';

    const display = document.createElement('span');
    display.className = 'display-date';

    const updateDisplay = () => {
      const val = exp.value;
      if (!val) return;
      const [y, m, d] = val.split('-');
      const dateObj = new Date(+y, +m - 1, +d);
      display.textContent = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      div.classList.toggle('expiring-soon',
        (dateObj - new Date()) / (1000*60*60*24) < 3);
    };

    exp.addEventListener('change', updateDisplay);

    const rem = document.createElement('button');
    rem.type = 'button';
    rem.textContent = '×';
    rem.addEventListener('click', () => div.remove());

    div.append(stock, exp, display, rem);
    list.append(div);
  })
);

// Gather expiry alerts
function gatherExpiryAlerts() {
  const alerts = [];
  const today = new Date();

  document.querySelectorAll('.expiry-item').forEach(div => {
    const row = div.closest('tr');
    const itemName = row.querySelector('td').innerText;
    const qty = div.querySelector('input[type="number"]').value;
    const dateVal = div.querySelector('input[type="date"]').value;
    if (!qty || !dateVal) return;

    const [y, m, d] = dateVal.split('-');
    const expDate = new Date(+y, +m - 1, +d);
    if (isNaN(expDate)) return;

    const diffDays = Math.floor((expDate - today) / (1000*60*60*24));
    if (diffDays >= 0 && diffDays < 3) {
      alerts.push({
        item: itemName,
        qty,
        date: expDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        daysLeft: diffDays
      });
    }
  });

  return alerts;
}

// Save to PDF with expiry section
function savePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');

  const now = new Date();
  doc.text('Poultry Order', 40, 30);
  doc.setFontSize(10);
  doc.text(`Generated on: ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, 40, 45);

  const orderRows = [...document.querySelectorAll('tbody tr')].map(tr => [
    tr.cells[0].innerText,
    tr.querySelector('[data-day="Monday"]').value || '0',
    tr.querySelector('[data-day="Wednesday"]').value || '0',
    tr.querySelector('[data-day="Friday"]').value || '0',
    tr.querySelector('.total-input').value || '0'
  ]);

  doc.autoTable({
    head: [['Item', 'Mon', 'Wed', 'Fri', 'Total']],
    body: orderRows,
    startY: 60
  });

  const alerts = gatherExpiryAlerts();
  if (alerts.length) {
    doc.addPage();
    doc.text('⚠️ Expiry Alerts (within 3 days)', 40, 30);
    const alertRows = alerts.map(a => [a.item, a.qty, a.date, `${a.daysLeft} day(s)`]);
    doc.autoTable({
      head: [['Item', 'Qty', 'Expiry', 'Days Left']],
      body: alertRows,
      startY: 50
    });
  }

  doc.save('poultry-order.pdf');
}

// Excel export
function exportExcel() {
  const sheet = [['Item', 'Mon', 'Wed', 'Fri', 'Total']];
  document.querySelectorAll('tbody tr').forEach(tr => {
    sheet.push([
      tr.cells[0].innerText,
      tr.querySelector('[data-day="Monday"]').value || 0,
      tr.querySelector('[data-day="Wednesday"]').value || 0,
      tr.querySelector('[data-day="Friday"]').value || 0,
      tr.querySelector('.total-input').value || 0
    ]);
  });

  const alerts = gatherExpiryAlerts();
  if (alerts.length) {
    sheet.push([]);
    sheet.push(['⚠️ Expiry Alerts (within 3 days)']);
    sheet.push(['Item', 'Qty', 'Expiry', 'Days Left']);
    alerts.forEach(a => sheet.push([a.item, a.qty, a.date, `${a.daysLeft} day(s)`]));
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheet);
  XLSX.utils.book_append_sheet(wb, ws, 'Order & Alerts');
  XLSX.writeFile(wb, 'poultry-order.xlsx');
}

document.getElementById('savePdf').addEventListener('click', savePDF);
document.getElementById('exportExcel').addEventListener('click', exportExcel);
