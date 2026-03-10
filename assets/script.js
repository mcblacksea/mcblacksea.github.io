const currencyOptions = [
  'USD', 'EUR', 'GBP', 'UAH', 'TRY', 'PLN', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'SEK', 'NOK',
  'DKK', 'CZK', 'HUF', 'RON', 'BGN', 'SGD', 'HKD', 'NZD', 'MXN', 'BRL', 'INR', 'ZAR'
];

function byId(id) {
  return document.getElementById(id);
}

function setYear() {
  const yearEl = byId('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function createOption(currency, selected) {
  const opt = document.createElement('option');
  opt.value = currency;
  opt.textContent = currency;
  opt.selected = selected;
  return opt;
}

function initThemeToggle() {
  const html = document.documentElement;
  const button = byId('themeToggle');
  const label = byId('themeToggleText');
  const storedTheme = localStorage.getItem('site-theme');
  const preferredTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const activeTheme = storedTheme || preferredTheme;

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('site-theme', theme);
    if (label) label.textContent = theme === 'dark' ? 'Night mode' : 'Day mode';
  }

  applyTheme(activeTheme);

  if (button) {
    button.addEventListener('click', () => {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }
}

async function initConverter() {
  const amountEl = byId('amount');
  const fromEl = byId('fromCurrency');
  const toEl = byId('toCurrency');
  const resultEl = byId('converterResult');
  const metaEl = byId('converterMeta');
  const formEl = byId('converter-form');
  const swapEl = byId('swapCurrencies');

  if (!formEl || !fromEl || !toEl) return;

  currencyOptions.forEach((code) => {
    fromEl.appendChild(createOption(code, code === 'USD'));
    toEl.appendChild(createOption(code, code === 'EUR'));
  });

  async function convert() {
    const amount = Number(amountEl.value || 0);
    const from = fromEl.value;
    const to = toEl.value;

    if (!amount || amount < 0) {
      resultEl.textContent = 'Enter a valid amount.';
      return;
    }

    resultEl.textContent = 'Converting…';
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      const converted = data?.rates?.[to];
      if (typeof converted !== 'number') throw new Error('No conversion result');
      resultEl.innerHTML = `<strong>${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${from}</strong> = <strong>${converted.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}</strong>`;
      metaEl.textContent = `Rate date: ${data.date}. Base: ${data.base}.`;
    } catch (error) {
      resultEl.textContent = 'Unable to load exchange rates right now.';
      metaEl.textContent = '';
    }
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    convert();
  });

  if (swapEl) {
    swapEl.addEventListener('click', () => {
      const current = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = current;
      convert();
    });
  }

  convert();
}

async function loadNewsPreview() {
  const previewEl = byId('newsPreview');
  if (!previewEl) return;

  try {
    const res = await fetch('data/news.json');
    const data = await res.json();
    previewEl.innerHTML = '';
    (data.items || []).slice(0, 4).forEach((item) => {
      const article = document.createElement('a');
      article.className = 'news-preview-item';
      article.href = item.link;
      article.target = '_blank';
      article.rel = 'noreferrer';
      article.innerHTML = `
        <strong>${item.title}</strong>
        <div class="meta-row"><span>${item.source}</span><span>${new Date(item.published).toLocaleString()}</span></div>
        <p class="small muted">${item.summary || ''}</p>
      `;
      previewEl.appendChild(article);
    });
  } catch {
    previewEl.innerHTML = '<p class="small muted">News preview is not available yet. Run the news workflow once after publishing.</p>';
  }
}

async function loadNewsPage() {
  const gridEl = byId('newsGrid');
  const filtersEl = byId('newsFilters');
  const updatedEl = byId('newsUpdatedAt');
  if (!gridEl) return;

  try {
    const res = await fetch('data/news.json');
    const data = await res.json();
    const items = data.items || [];
    const sources = ['All', ...Array.from(new Set(items.map((item) => item.source)))];
    let activeSource = 'All';

    if (updatedEl && data.generated_at) {
      updatedEl.textContent = `Last generated: ${new Date(data.generated_at).toLocaleString()}`;
    }

    const renderItems = () => {
      const filtered = activeSource === 'All' ? items : items.filter((item) => item.source === activeSource);
      gridEl.innerHTML = filtered.map((item) => `
        <a class="news-card" href="${item.link}" target="_blank" rel="noreferrer">
          <span class="tile-tag">${item.source}</span>
          <h3>${item.title}</h3>
          <div class="meta-row">
            <span>${new Date(item.published).toLocaleString()}</span>
            <span>${item.category || 'General'}</span>
          </div>
          <p class="small muted">${item.summary || ''}</p>
        </a>
      `).join('');
    };

    if (filtersEl) {
      filtersEl.innerHTML = '';
      sources.forEach((source) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip ${source === activeSource ? 'active' : ''}`;
        btn.textContent = source;
        btn.addEventListener('click', () => {
          activeSource = source;
          [...filtersEl.children].forEach((el) => el.classList.remove('active'));
          btn.classList.add('active');
          renderItems();
        });
        filtersEl.appendChild(btn);
      });
    }

    renderItems();
  } catch {
    gridEl.innerHTML = '<p class="small muted">No news data yet. Commit the workflow and wait for the first scheduled or manual run.</p>';
  }
}

async function loadPosts(file, targetId) {
  const gridEl = byId(targetId);
  if (!gridEl) return;

  try {
    const res = await fetch(file);
    const posts = await res.json();
    gridEl.innerHTML = posts.map((post) => {
      const wrapperStart = post.url ? `<a class="post-card" href="${post.url}">` : '<article class="post-card">';
      const wrapperEnd = post.url ? '</a>' : '</article>';
      return `
        ${wrapperStart}
          <span class="tile-tag">${post.tag}</span>
          <h3>${post.title}</h3>
          <div class="meta-row"><span>${post.date}</span><span>${post.read_time}</span></div>
          <p class="small muted">${post.excerpt}</p>
        ${wrapperEnd}
      `;
    }).join('');
  } catch {
    gridEl.innerHTML = '<p class="small muted">Posts are not available right now.</p>';
  }
}

setYear();
initThemeToggle();
initConverter();
loadNewsPreview();
loadNewsPage();
loadPosts('data/travel-posts.json', 'travelGrid');
loadPosts('data/startup-posts.json', 'startupGrid');
