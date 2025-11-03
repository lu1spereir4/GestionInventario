import './main.css';
import './App.css';

const MAX_RECENT_SALES = 8;
const state = {
  summary: { revenue: 0, count: 0 },
  recentSales: [],
  pendingQueue: [],
  highlight: null,
  alert: null,
};

let alertTimer = null;
let highlightTimer = null;

const root = document.getElementById('root');
root.innerHTML = `
  <div class="app-shell">
    <header class="header">
      <div>
        <h1>Wessex Punto de Venta</h1>
        <p class="subtitle">Escanea productos y visualiza el avance del día.</p>
      </div>
      <div class="summary">
        <div>
          <span class="summary-label">Ganancias del día</span>
          <span class="summary-value" data-summary="revenue">$0</span>
        </div>
        <div>
          <span class="summary-label">Productos vendidos</span>
          <span class="summary-value" data-summary="count">0</span>
        </div>
      </div>
    </header>
    <div class="alert hidden" data-alert></div>
    <main class="content">
      <section class="highlight" data-highlight>
        <div class="placeholder">Escanea un producto para comenzar</div>
      </section>
      <aside class="sidebar">
        <h3>Últimas ventas</h3>
        <ul class="sales-list" data-sales-list></ul>
      </aside>
    </main>
  </div>
`;

const summaryRevenueEl = root.querySelector('[data-summary="revenue"]');
const summaryCountEl = root.querySelector('[data-summary="count"]');
const alertEl = root.querySelector('[data-alert]');
const highlightEl = root.querySelector('[data-highlight]');
const salesListEl = root.querySelector('[data-sales-list]');

const modalBackdrop = document.createElement('div');
modalBackdrop.className = 'modal-backdrop hidden';
modalBackdrop.innerHTML = `
  <form class="modal">
    <img src="/images/varios.svg" alt="Producto" data-modal-image />
    <h2 data-modal-title>Precio personalizado</h2>
    <p>Ingresa el valor a registrar antes de confirmar.</p>
    <input
      data-modal-input
      type="number"
      inputmode="decimal"
      min="0"
      step="50"
      placeholder="0"
      autocomplete="off"
    />
    <div class="modal-actions">
      <button type="button" data-modal-skip>Omitir</button>
      <button type="submit" class="primary">Registrar</button>
    </div>
  </form>
`;

document.body.appendChild(modalBackdrop);
const modalForm = modalBackdrop.querySelector('.modal');
const modalImage = modalBackdrop.querySelector('[data-modal-image]');
const modalTitle = modalBackdrop.querySelector('[data-modal-title]');
const modalInput = modalBackdrop.querySelector('[data-modal-input]');
const modalSkip = modalBackdrop.querySelector('[data-modal-skip]');

function formatCurrency(value) {
  if (value == null) return '-';
  const amount = Number(value);
  if (Number.isNaN(amount)) return '-';
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  return `\$${amount.toLocaleString('es-CL', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  })}`;
}

function renderSummary() {
  summaryRevenueEl.textContent = formatCurrency(state.summary.revenue || 0);
  summaryCountEl.textContent = state.summary.count || 0;
}

function renderAlert() {
  if (!state.alert) {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
    return;
  }

  alertEl.textContent = state.alert;
  alertEl.classList.remove('hidden');
}

function showAlert(message) {
  state.alert = message;
  renderAlert();
  if (alertTimer) clearTimeout(alertTimer);
  if (message) {
    alertTimer = setTimeout(() => {
      state.alert = null;
      renderAlert();
    }, 4500);
  }
}

function renderRecentSales() {
  salesListEl.innerHTML = '';
  if (state.recentSales.length === 0) {
    const li = document.createElement('li');
    li.className = 'sales-empty';
    li.textContent = 'Sin registros todavía.';
    salesListEl.appendChild(li);
    return;
  }

  state.recentSales.forEach((sale) => {
    const li = document.createElement('li');
    li.className = 'sales-item';

    const img = document.createElement('img');
    img.src = sale.image || '/images/varios.svg';
    img.alt = sale.productName;

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = sale.productName;
    const price = document.createElement('span');
    price.textContent = formatCurrency(sale.total);
    info.append(name, price);

    li.append(img, info);
    salesListEl.appendChild(li);
  });
}

function renderHighlight() {
  highlightEl.innerHTML = '';
  if (!state.highlight) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Escanea un producto para comenzar';
    highlightEl.appendChild(placeholder);
    return;
  }

  const article = document.createElement('article');
  article.className = 'sale-card animate';

  const img = document.createElement('img');
  img.src = state.highlight.image || '/images/varios.svg';
  img.alt = state.highlight.productName;

  const details = document.createElement('div');
  details.className = 'sale-details';
  const title = document.createElement('h2');
  title.textContent = state.highlight.productName;
  const message = document.createElement('p');
  message.className = 'sale-message';
  message.textContent = 'Producto vendido';
  const price = document.createElement('p');
  price.className = 'sale-price';
  price.textContent = formatCurrency(state.highlight.total);

  details.append(title, message, price);
  article.append(img, details);
  highlightEl.appendChild(article);
}

function showHighlightSale(sale) {
  state.highlight = sale;
  renderHighlight();
  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    state.highlight = null;
    renderHighlight();
  }, 5200);
}

function renderModal() {
  const pending = state.pendingQueue[0];
  if (!pending) {
    modalBackdrop.classList.add('hidden');
    modalInput.value = '';
    return;
  }

  modalImage.src = pending.image || '/images/varios.svg';
  modalImage.alt = pending.productName;
  modalTitle.textContent = `Precio para ${pending.productName}`;
  modalInput.value = '';
  modalBackdrop.classList.remove('hidden');
  setTimeout(() => modalInput.focus(), 0);
}

async function handleSubmit(event) {
  event.preventDefault();
  const pending = state.pendingQueue[0];
  if (!pending) return;

  const numericPrice = Number(modalInput.value);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) {
    showAlert('Ingresa un precio válido.');
    return;
  }

  try {
    const response = await fetch(`/api/sales/${pending.scanId}/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: numericPrice }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo guardar el precio.');
    }

    state.pendingQueue.shift();
    renderModal();
  } catch (error) {
    showAlert(error.message);
  }
}

modalForm.addEventListener('submit', handleSubmit);
modalSkip.addEventListener('click', () => {
  state.pendingQueue.shift();
  renderModal();
});

function applyDashboard(data) {
  state.summary = data.summary || { revenue: 0, count: 0 };
  state.recentSales = (data.recentSales || []).slice(0, MAX_RECENT_SALES);
  state.pendingQueue = data.pendingVariableSales || [];
  renderSummary();
  renderRecentSales();
  renderModal();
}

async function fetchDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('No se pudo cargar el resumen');
    const data = await response.json();
    applyDashboard(data);
  } catch (error) {
    console.error(error);
    showAlert('No se pudo obtener el estado inicial. Revisa el servidor.');
  }
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

  socket.addEventListener('message', (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);
      switch (type) {
        case 'dashboard:init':
          applyDashboard(payload);
          break;
        case 'sale:completed':
          showHighlightSale(payload);
          state.recentSales = [payload, ...state.recentSales].slice(0, MAX_RECENT_SALES);
          state.pendingQueue = state.pendingQueue.filter((item) => item.scanId !== payload.scanId);
          renderRecentSales();
          renderModal();
          break;
        case 'summary:update':
          state.summary = payload;
          renderSummary();
          break;
        case 'sale:needs-price':
          state.pendingQueue.push(payload);
          renderModal();
          showAlert(null);
          break;
        case 'scan:unknown':
          showAlert(`Código sin asignar: ${payload.barcode}`);
          break;
        case 'sync:error':
          showAlert(`Sincronización fallida: ${payload.message}`);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Mensaje WS inválido', error);
    }
  });

  socket.addEventListener('close', () => {
    setTimeout(connectWebSocket, 2500);
  });
}

fetchDashboard();
renderSummary();
renderRecentSales();
renderHighlight();
connectWebSocket();
