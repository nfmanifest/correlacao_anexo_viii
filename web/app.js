// Correlação NFS — consulta do Anexo VIII em página estática, sem dependências.
// Os dados vêm de data/anexo8.json, gerado por ../build/gerar.py.
(async () => {
  const UI_VERSION = '2026-10-24.4';
  const documentVersion = document.documentElement.dataset.uiVersion;

  // Um HTML antigo em cache pode carregar o JavaScript novo e quebrar a tela.
  // Nesse caso, força apenas uma recarga do documento com uma chave de versão.
  if (documentVersion !== UI_VERSION) {
    const freshUrl = new URL(window.location.href);
    if (freshUrl.searchParams.get('_ui') !== UI_VERSION) {
      freshUrl.searchParams.set('_ui', UI_VERSION);
      window.location.replace(freshUrl.href);
    }
    return;
  }

  // Remove a chave técnica depois que a versão correta já foi carregada.
  const loadedUrl = new URL(window.location.href);
  if (loadedUrl.searchParams.get('_ui') === UI_VERSION) {
    loadedUrl.searchParams.delete('_ui');
    try { history.replaceState(null, '', loadedUrl.href); } catch (e) { }
  }

  const $ = s => document.querySelector(s);
  const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
  const nf = n => n.toLocaleString('pt-BR');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const compact = s => norm(s).replace(/[^a-z0-9]/g, '');
  const terms = q => norm(q).trim().split(/\s+/).filter(Boolean);
  const textMatches = (text, query) => {
    const value = norm(text), packed = compact(text);
    return terms(query).some(term => value.includes(term) || (/\d/.test(term) && packed.includes(compact(term))));
  };

  /* ---------- tema e modo embutido ---------- */
  const THEME_KEY = 'nexo-theme';
  const embedded = window.self !== window.top;
  if (embedded) document.documentElement.dataset.embedded = 'true';
  const themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function currentTheme() {
    const set = document.documentElement.dataset.theme;
    if (set === 'light' || set === 'dark') return set;
    return themeQuery && themeQuery.matches ? 'dark' : 'light';
  }
  function syncThemeButton() {
    const b = $('#theme-toggle');
    if (!b) return;
    const dark = currentTheme() !== 'light';
    b.textContent = dark ? '☼ Tema claro' : '◐ Tema escuro';
    b.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
  }
  function applyTheme(theme, notify = true) {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    if (!embedded) { try { localStorage.setItem(THEME_KEY, value); } catch (e) { } }
    syncThemeButton();
    if (notify && embedded) {
      try { parent.postMessage({ type: 'nexo:theme', theme: value }, '*'); } catch (e) { }
    }
  }
  const themeBtn = $('#theme-toggle');
  if (themeBtn) themeBtn.onclick = () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  syncThemeButton();

  function showLoadError() {
    const detail = $('#detail');
    detail.textContent = '';
    detail.setAttribute('aria-busy', 'false');
    const box = el('div', 'load-error');
    box.appendChild(el('h2', null, 'Não foi possível carregar a consulta'));
    box.appendChild(el('p', null, 'Verifique sua conexão e tente novamente. Nenhum dado foi alterado.'));
    const retry = el('button', 'primary-btn', 'Tentar novamente');
    retry.type = 'button'; retry.onclick = () => window.location.reload();
    box.appendChild(retry); detail.appendChild(box);
  }

  let D = window.__ANEXO8__;
  if (!D) {
    try {
      const resposta = await fetch('data/anexo8.json');
      if (!resposta.ok) throw new Error('Falha ao carregar os dados');
      D = await resposta.json();
    } catch (erro) {
      showLoadError();
      return;
    }
  }

  let FONTES = window.__FONTES__;
  if (!FONTES) {
    try {
      const resposta = await fetch('data/fontes-oficiais.json');
      if (resposta.ok) FONTES = await resposta.json();
    } catch (erro) { /* catálogo é opcional */ }
  }

  async function carregarJson(global, arquivo) {
    if (window[global]) return window[global];
    try {
      const resposta = await fetch(arquivo);
      if (resposta.ok) return await resposta.json();
    } catch (erro) { /* tabela opcional */ }
    return null;
  }
  const CFOP = await carregarJson('__CFOP__', 'data/cfop.json');
  const CCLASS = await carregarJson('__CCLASS__', 'data/cclass.json');
  const CCLASSTRIB = await carregarJson('__CCLASSTRIB__', 'data/cclasstrib.json');
  const REFORMA = await carregarJson('__REFORMA__', 'data/reforma.json');
  const LC214 = await carregarJson('__LC214__', 'data/lc214.json');

  const LOC_ORDER = ['Local da prestação', 'Domicílio principal do adquirente', 'Local do imóvel',
    'Local da entrega ou da disponibilização', 'Local do evento', 'Domicílio principal do adquirente (matriz)', 'Via explorada'];
  const INCX = { '100101': ['100101', '100102', '100201'], '100301': ['100301', '100302', '100401'], '100501': ['100501', '100502', '100601'] };
  const indopLocal = code => ((D.indop || {})[code] || {}).l || '';

  /* ---------- índice ---------- */
  const ITENS = Object.keys(D.rotas).sort();
  const INDEX = ITENS.map(code => {
    const rotas = D.rotas[code], locais = new Set(), inds = new Set(), ccs = new Set();
    let nbsN = 0, semCod = 0;
    const partes = [code, D.itens[code] || ''];
    rotas.forEach(rt => {
      rt.nbs.forEach(n => {
        if (n.startsWith('§')) { semCod++; partes.push('nbs sem codigo', n.slice(1)); }
        else { nbsN++; partes.push('nbs ' + n, D.nbs[n] || ''); }
      });
      rt.r.forEach(b => {
        const local = indopLocal(b.i);
        if (b.i) { inds.add(b.i); partes.push('indop ' + b.i); }
        if (local) { locais.add(local); partes.push(local); }
        b.c.forEach(c => {
          ccs.add(c);
          const cc = D.cclasstrib[c] || {};
          partes.push('cclasstrib ' + c, cc.n || '', 'cst ' + (cc.cst || ''), cc.dcst || '', 'artigo ' + (cc.art || ''));
        });
      });
    });
    const grp = code.split('.')[0];
    partes.push('grupo ' + grp, (D.grupos || {})[grp] || '');
    const blob = norm(partes.join(' '));
    return { code, grp, desc: D.itens[code] || '', rotas, locais, inds, ccs, nbsN, semCod, blob, packed: compact(blob) };
  });
  const BY = Object.fromEntries(INDEX.map(i => [i.code, i]));

  const LS = 'anexo8.sel';
  const urlInicial = new URL(window.location.href);
  const itemUrl = urlInicial.searchParams.get('item');
  let stored = null;
  try { stored = localStorage.getItem(LS); } catch (e) { }
  let state = { q: '', grp: '', loc: null, cc: '', sel: (itemUrl && BY[itemUrl]) ? itemUrl : ((stored && BY[stored]) ? stored : ITENS[0]) };
  let view = [];

  function syncUrl(tab) {
    const url = new URL(window.location.href);
    if (state.sel) url.searchParams.set('item', state.sel);
    if (tab && tab !== 'fluxo') url.searchParams.set('tab', tab);
    else url.searchParams.delete('tab');
    try { history.replaceState(null, '', url.href); } catch (e) { }
  }

  let toastTimer = null;
  function toast(message) {
    const box = $('#toast');
    clearTimeout(toastTimer); box.textContent = message; box.hidden = false;
    toastTimer = setTimeout(() => { box.hidden = true; }, 2200);
  }
  async function copyText(value, message) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      const input = el('textarea'); input.value = value; input.setAttribute('readonly', '');
      input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input);
      input.select(); document.execCommand('copy'); input.remove();
    }
    toast(message);
  }
  function copyButton(value, label, full = false) {
    const b = el('button', full ? 'copy-btn copy-btn-full' : 'copy-btn');
    b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    b.appendChild(el('span', 'copy-icon', '⧉'));
    if (full) b.appendChild(el('span', null, 'Copiar código'));
    b.onclick = e => { e.stopPropagation(); copyText(value, value + ' copiado'); };
    return b;
  }

  // Dentro do iframe (srcdoc) a URL é "about:srcdoc": usa a URL do portal.
  function portalUrl() {
    if (window.location.href.indexOf('about:') === 0) {
      try {
        if (window.parent && window.parent !== window && window.parent.location.href) {
          return window.parent.location.href;
        }
      } catch (e) { }
      try { if (document.referrer) return document.referrer; } catch (e) { }
      return '';
    }
    return window.location.href;
  }

  /* ---------- filtros ---------- */
  function apply() {
    const queryTerms = terms(state.q);
    view = INDEX.filter(it =>
      (!state.grp || it.grp === state.grp) &&
      (!state.loc || it.locais.has(state.loc)) &&
      (!state.cc || it.ccs.has(state.cc)) &&
      (!queryTerms.length || queryTerms.every(term => it.blob.includes(term) || (/\d/.test(term) && it.packed.includes(compact(term))))));
    if (view.length && !view.some(it => it.code === state.sel)) select(view[0].code, false);
  }
  function select(code, persist = true) {
    state.sel = code;
    if (persist) { try { localStorage.setItem(LS, code); } catch (e) { } }
    syncUrl();
  }

  /* ---------- rail ---------- */
  function renderLocSel() {
    const s = $('#locsel');
    s.appendChild(new Option('Todos os locais', ''));
    LOC_ORDER.filter(l => l in D.locais).forEach(l => {
      s.appendChild(new Option(l.replace('Domicílio principal do adquirente (matriz)', 'Domicílio (matriz)'), l));
    });
    s.onchange = () => { state.loc = s.value || null; apply(); renderList(); renderDetail(); };
  }
  function renderGrpSel() {
    const g = $('#gsel');
    g.appendChild(new Option('Todos os grupos', ''));
    Object.keys(D.grupos).sort().forEach(k => {
      const nome = D.grupos[k];
      g.appendChild(new Option(k + ' · ' + (nome.length > 44 ? nome.slice(0, 43) + '…' : nome) + '  (' + D.grupoN[k] + ')', k));
    });
    g.onchange = () => { state.grp = g.value; apply(); renderList(); renderDetail(); };
  }
  function renderCcSel() {
    const s = $('#ccsel');
    s.appendChild(new Option('Todas as classificações', ''));
    Object.keys(D.cclasstrib).sort().forEach(c => {
      const nome = D.cclasstrib[c].n;
      s.appendChild(new Option(c + ' · ' + (nome.length > 46 ? nome.slice(0, 45) + '…' : nome), c));
    });
    s.onchange = () => { state.cc = s.value; apply(); renderList(); renderDetail(); };
  }
  function mark(txt, query) {
    if (!query) return el('span', 'd', txt);
    const normalized = norm(txt);
    const hit = terms(query).sort((a, b) => b.length - a.length).find(term => normalized.includes(term));
    if (!hit) return el('span', 'd', txt);
    const i = normalized.indexOf(hit);
    if (i < 0) return el('span', 'd', txt);
    const sp = el('span', 'd');
    sp.append(txt.slice(0, i), el('mark', null, txt.slice(i, i + hit.length)), txt.slice(i + hit.length));
    return sp;
  }
  function renderList() {
    const list = $('#list'), query = state.q.trim();
    $('#cnt').textContent = view.length === ITENS.length
      ? nf(ITENS.length) + ' subitens' : nf(view.length) + ' de ' + nf(ITENS.length);
    $('#clr').hidden = !(state.q || state.grp || state.loc || state.cc);
    list.textContent = '';
    if (!view.length) {
      const empty = el('div', 'empty');
      empty.appendChild(el('strong', null, 'Nenhum subitem encontrado'));
      empty.appendChild(el('span', null, 'Revise os termos pesquisados ou remova algum filtro.'));
      const reset = el('button', 'secondary-btn', 'Limpar busca e filtros');
      reset.type = 'button'; reset.onclick = clearFilters;
      empty.appendChild(reset); list.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    view.forEach(it => {
      const b = el('button', 'li'); b.type = 'button'; b.dataset.code = it.code;
      b.setAttribute('aria-current', String(it.code === state.sel));
      b.appendChild(el('span', 'c', it.code));
      b.appendChild(mark(it.desc, query));
      const n = it.nbsN + (it.semCod ? ' + ' + it.semCod + ' s/ código' : '');
      b.appendChild(el('span', 'm', n + ' NBS · ' + it.rotas.length + (it.rotas.length > 1 ? ' rotas' : ' rota')));
      b.onclick = () => {
        select(it.code); renderList(); renderDetail();
        if (window.matchMedia('(max-width: 920px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      frag.appendChild(b);
    });
    list.appendChild(frag);
    const cur = list.querySelector('[aria-current="true"]');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function step(delta) {
    const i = view.findIndex(it => it.code === state.sel);
    const j = Math.min(view.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta));
    if (j !== i && view[j]) { select(view[j].code); renderList(); renderDetail(); }
  }

  function clearFilters() {
    state.q = ''; state.grp = ''; state.loc = null; state.cc = '';
    $('#q').value = ''; $('#gsel').value = ''; $('#ccsel').value = ''; $('#locsel').value = '';
    apply(); renderList(); renderDetail();
    $('#q').focus();
  }

  /* ---------- flowchart ---------- */
  function nbsBox(nbs, query) {
    const box = el('div', 'nbsbox'), LIM = 6;
    const hit = c => query && (textMatches(c, query) || textMatches(D.nbs[c] || c.slice(1), query));
    const ordered = query ? [...nbs].sort((a, b) => (hit(b) ? 1 : 0) - (hit(a) ? 1 : 0)) : nbs;
    if (ordered.some(hit)) box.classList.add('hit');
    const draw = upTo => {
      box.textContent = '';
      ordered.slice(0, upTo).forEach(code => {
        const r = el('div', 'nbsrow');
        if (hit(code)) r.classList.add('hit');
        if (code.startsWith('§')) {
          r.classList.add('nocode');
          r.appendChild(el('span', 'c', 'sem código'));
          r.appendChild(mark(code.slice(1), query));
        } else {
          const codeWrap = el('span', 'code-with-copy');
          codeWrap.append(el('span', 'c', code), copyButton(code, 'Copiar NBS ' + code));
          r.appendChild(codeWrap);
          r.appendChild(mark(D.nbs[code] || '', query));
        }
        box.appendChild(r);
      });
      if (upTo < ordered.length) {
        const m = el('button', 'more', 'mostrar os outros ' + (ordered.length - upTo) + ' NBS');
        m.type = 'button'; m.onclick = () => { draw(ordered.length); wireUp(); }; box.appendChild(m);
      } else if (ordered.length > LIM) {
        const m = el('button', 'more', 'recolher');
        m.type = 'button'; m.onclick = () => { draw(LIM); wireUp(); }; box.appendChild(m);
      }
    };
    draw(LIM);
    return box;
  }
  function branchNode(b, query) {
    if (!b.i) {
      const g = el('div', 'gap');
      g.innerHTML = '<b>Sem indOp, sem local de incidência e sem cClassTrib.</b> É a única linha do anexo sem nenhuma correlação — linha 1348 da planilha.';
      g.prepend(el('div', 'mobile-stage-label lbl3', 'indOp · onde incide'));
      return g;
    }
    const n = el('div', 'node');
    if (query && textMatches(b.i, query)) n.classList.add('hit');
    n.appendChild(el('div', 'mobile-stage-label lbl3', 'indOp · onde incide'));
    const codeWrap = el('div', 'code-with-copy');
    codeWrap.append(el('span', 'c', b.i), copyButton(b.i, 'Copiar indOp ' + b.i));
    n.appendChild(codeWrap);
    n.appendChild(el('div', 'l', indopLocal(b.i) || 'Local não informado'));
    if (INCX[b.i]) {
      const cond = el('div', 'cond');
      cond.innerHTML = 'Vale para <b>prestação onerosa</b> com <b>adquirente no país</b>.';
      n.appendChild(cond);
      const btn = el('button', 'incx', 'ver a regra do inciso X'); btn.type = 'button';
      const m = el('div', 'matrix'); m.hidden = true;
      const v = INCX[b.i];
      m.innerHTML =
        '<div class="mcap">Estes códigos <b>não são alternativas deste subitem na tabela</b>. ' +
        'Vêm da aba REGRA inc. X: são o substituto do indOp quando a operação foge do caso-base.</div>' +
        '<table><thead><tr><th>Onerosa<br>no país</th><th>Onerosa<br>exterior</th><th>Não<br>onerosa</th></tr></thead>' +
        '<tbody><tr><td class="here">' + v[0] + '</td><td class="off">' + v[1] + '</td><td class="off">' + v[2] + '</td></tr></tbody></table>' +
        '<div class="mfoot">A linha deste subitem traz <b>PS onerosa = S</b> e <b>Adq. exterior = N</b>, por isso o anexo registra ' +
        '<b>' + v[0] + '</b>. O ' + v[1] + ' e o ' + v[2] + ' não aparecem em nenhuma das 1.521 linhas da tabela de correlação.</div>';
      btn.onclick = () => { m.hidden = !m.hidden; btn.textContent = m.hidden ? 'ver a regra do inciso X' : 'ocultar a regra'; wireUp(); };
      n.append(btn, m);
    }
    return n;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (t, attrs) => { const n = document.createElementNS(NS, t); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  function drawWires(flow) {
    let svg = flow.querySelector('svg.wires');
    if (!svg) { svg = svgEl('svg', { class: 'wires' }); flow.appendChild(svg); }
    svg.textContent = '';
    if (window.innerWidth <= 760) return;
    const fr = flow.getBoundingClientRect();
    if (!fr.width) return;
    svg.setAttribute('viewBox', '0 0 ' + fr.width + ' ' + fr.height);
    svg.setAttribute('width', fr.width);
    svg.setAttribute('height', fr.height);

    const nbs = flow.querySelector('.nbsbox');
    const links = [];
    flow.querySelectorAll('.branch').forEach(br => {
      const node = br.querySelector('.node, .gap');
      if (!node) return;
      if (nbs) links.push([nbs, node, 'w2']);
      br.querySelectorAll('.cc').forEach(cc => links.push([node, cc, 'w3']));
    });

    links.forEach(([a, b, tone]) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const x1 = ra.right - fr.left, y1 = ra.top - fr.top + ra.height / 2;
      const x2 = rb.left - fr.left, y2 = rb.top - fr.top + Math.min(rb.height / 2, 28);
      if (x2 <= x1) return;
      const dx = Math.max(16, (x2 - x1) * 0.55);
      svg.appendChild(svgEl('path', {
        class: tone,
        d: 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2
      }));
      svg.appendChild(svgEl('circle', { class: tone, cx: x1, cy: y1, r: 2.6 }));
      svg.appendChild(svgEl('circle', { class: tone, cx: x2, cy: y2, r: 2.6 }));
    });
  }

  let ro = null;
  function wireUp() {
    const flows = document.querySelectorAll('#detail .flow');
    if (ro) ro.disconnect();
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(entries => entries.forEach(e => drawWires(e.target)));
      flows.forEach(f => ro.observe(f));
    }
    requestAnimationFrame(() => flows.forEach(drawWires));
  }
  let wt = null;
  function syncHeader() {
    const h = document.querySelector('header.top');
    if (h) document.documentElement.style.setProperty('--hdr', Math.round(h.getBoundingClientRect().height) + 'px');
  }
  window.addEventListener('resize', () => { clearTimeout(wt); wt = setTimeout(() => { syncHeader(); wireUp(); }, 120); });
  if ('ResizeObserver' in window) {
    const hr = new ResizeObserver(syncHeader);
    const h = document.querySelector('header.top');
    if (h) hr.observe(h);
  }
  syncHeader();

  function renderDetail() {
    const d = $('#detail'), query = state.q.trim();
    d.textContent = '';
    d.setAttribute('aria-busy', 'false');
    if (!view.length) {
      const empty = el('div', 'detail-empty');
      empty.appendChild(el('div', 'empty-icon', '⌕'));
      empty.appendChild(el('h2', null, 'Não há correlação para exibir'));
      empty.appendChild(el('p', null, 'Ajuste a busca ou os filtros para encontrar um subitem da LC 116.'));
      const reset = el('button', 'primary-btn', 'Limpar busca e filtros');
      reset.type = 'button'; reset.onclick = clearFilters;
      empty.appendChild(reset); d.appendChild(empty);
      return;
    }
    const it = BY[state.sel] || view[0];

    const head = el('div', 'itemhead');
    const nav = el('div', 'navrow');
    const pos = view.findIndex(x => x.code === it.code);
    nav.appendChild(el('span', 'pos', pos >= 0 ? 'Subitem ' + (pos + 1) + ' de ' + nf(view.length) : 'Subitem'));
    const navActions = el('div', 'nav-actions');
    const share = el('button', 'share-btn'); share.type = 'button';
    share.append(el('span', null, 'Compartilhar consulta'), el('span', 'share-icon', '↗'));
    share.onclick = () => {
      syncUrl();
      const url = portalUrl();
      if (!url) { toast('Copie o endereço da barra do navegador'); return; }
      copyText(url, embedded ? 'Link do portal copiado' : 'Link da consulta copiado');
    };
    navActions.appendChild(share);
    const nb = el('div', 'nav');
    [['‹', -1, 'Subitem anterior'], ['›', 1, 'Próximo subitem']].forEach(([g, dl, lab]) => {
      const b = el('button', null, g); b.type = 'button'; b.title = lab; b.setAttribute('aria-label', lab);
      b.disabled = pos < 0 || (dl < 0 ? pos === 0 : pos === view.length - 1);
      b.onclick = () => step(dl); nb.appendChild(b);
    });
    navActions.appendChild(nb); nav.appendChild(navActions); head.appendChild(nav);

    const g = (D.grupos || {})[it.grp];
    if (g) {
      const gl = el('div', 'grpline');
      gl.appendChild(el('span', 'gc', 'Lista ' + it.grp));
      gl.appendChild(el('span', null, g));
      head.appendChild(gl);
    }
    const k = el('div', 'k');
    k.appendChild(el('span', 'lbl', 'Subitem LC 116'));
    const mainCode = el('span', 'main-code');
    mainCode.append(el('span', 'code', it.code), copyButton(it.code, 'Copiar subitem ' + it.code, true));
    k.appendChild(mainCode);
    head.appendChild(k);
    head.appendChild(el('p', null, it.desc));

    const facts = el('div', 'facts');
    const add = html => { const f = el('div', 'fact'); f.innerHTML = html; facts.appendChild(f); };
    add('<b>' + it.nbsN + '</b> NBS');
    if (it.semCod) add('<b>' + it.semCod + '</b> sem código NBS');
    add('<b>' + it.rotas.length + '</b> ' + (it.rotas.length > 1 ? 'rotas' : 'rota'));
    add('<b>' + it.inds.size + '</b> indOp');
    add('<b>' + it.ccs.size + '</b> cClassTrib');
    [...it.locais].forEach(l => add(l));
    head.appendChild(facts);
    d.appendChild(head);

    const wrap = el('div', 'rotas');
    it.rotas.forEach((rt, i) => {
      const card = el('div', 'rota');
      const hd = el('div', 'rotahd');
      hd.appendChild(el('span', 'n', 'Rota ' + (i + 1) + ' de ' + it.rotas.length));
      const nOk = rt.nbs.filter(n => !n.startsWith('§')).length, semc = rt.nbs.length - nOk;
      const parts = [];
      if (nOk) parts.push(nOk + ' NBS');
      if (semc) parts.push(semc + (semc === 1 ? ' serviço sem código NBS' : ' serviços sem código NBS'));
      const ind = rt.r.filter(b => b.i).length;
      if (ind) parts.push(ind + ' indOp');
      hd.appendChild(el('span', 'meta', parts.join(' · ')));
      card.appendChild(hd);

      const flow = el('div', 'flow');
      const s2 = el('div', 'stage');
      s2.appendChild(el('div', 'stagelbl lbl2', 'NBS · o que foi fornecido'));
      s2.appendChild(nbsBox(rt.nbs, query));
      flow.appendChild(s2);

      const right = el('div', 'stage');
      const temCc = rt.r.some(b => b.c.length);
      const lbls = el('div', 'blbls');
      lbls.appendChild(el('div', 'stagelbl lbl3', 'indOp · onde incide'));
      if (temCc) lbls.appendChild(el('div', 'stagelbl lbl4', 'cClassTrib · como tributa'));
      right.appendChild(lbls);

      const br = el('div', 'branches');
      rt.r.forEach(b => {
        const row = el('div', 'branch'), g = el('div', 'bgrid');
        g.appendChild(branchNode(b, query));
        if (b.c.length) {
          const cl = el('div', 'ccs');
          cl.appendChild(el('div', 'mobile-stage-label lbl4', 'cClassTrib · como tributa'));
          b.c.forEach(c => {
            const o = D.cclasstrib[c] || {}, n = el('div', 'cc');
            if (query && (textMatches(c, query) || textMatches(o.n, query) || textMatches(o.cst, query) || textMatches(o.art, query))) n.classList.add('hit');
            if (o.div) n.classList.add('diverge');
            const codeWrap = el('span', 'code-with-copy');
            codeWrap.append(el('span', 'c', c), copyButton(c, 'Copiar cClassTrib ' + c));
            n.appendChild(codeWrap);
            n.appendChild(el('span', 'd', o.n));
            const meta = el('div', 'meta');
            if (o.cst) meta.appendChild(el('span', 'tag cst', 'CST ' + o.cst));
            if (o.dcst) meta.appendChild(el('span', 'tag', o.dcst));
            if (o.art) meta.appendChild(el('span', 'tag', 'LC 214/25 · ' + o.art));
            if (meta.children.length) n.appendChild(meta);
            if (o.div) n.appendChild(el('div', 'warn', o.div));
            cl.appendChild(n);
          });
          g.appendChild(cl);
        }
        row.appendChild(g); br.appendChild(row);
      });
      right.appendChild(br);
      flow.appendChild(right);
      card.appendChild(flow);
      wrap.appendChild(card);
    });
    d.appendChild(wrap);
    wireUp();
  }

  /* ---------- eventos ---------- */
  $('#q').addEventListener('input', e => { state.q = e.target.value; apply(); renderList(); renderDetail(); });
  $('#clr').onclick = clearFilters;
  $('#list').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
  });
  $('#q').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); $('#list').focus(); step(1); }
    else if (e.key === 'Escape' && (state.q || state.grp || state.loc || state.cc)) { e.preventDefault(); clearFilters(); }
  });
  document.addEventListener('keydown', e => {
    const editing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === '/' && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); $('#q').focus();
    }
  });

  $('.ver').textContent = D.meta.versao;
  $('.sub').textContent = nf(D.meta.subitens) + ' subitens · ' + nf(D.meta.nbs) +
    ' códigos NBS · ' + nf(D.meta.rotas) + ' rotas de correlação.';
  $('#source-anexo').textContent = D.meta.fonte_anexo + ' (' + D.meta.versao + ')';
  $('#source-cclass').textContent = D.meta.fonte_cc;
  $('#foot').textContent =
    'Fonte: ' + D.meta.fonte_anexo + ', a aba REGRA inc. X do mesmo arquivo e ' + D.meta.fonte_cc + '. ' +
    'Esta consulta reproduz o Anexo VIII ' + D.meta.versao + ' e preserva os códigos indOp do Anexo VII v1.01.00 usados na correlação original. ' +
    'A NT 009/2026 publicou o Anexo VII v1.02.00; não houve nova publicação correspondente do Anexo VIII nesta base. ' +
    'Lacunas da planilha aparecem marcadas em vermelho no fluxo.';

  /* ---------- tabelas de apoio ---------- */
  const DOC_NOME = { nfse: 'NFS-e', nfe: 'NF-e', nfcom: 'NFCom' };
  const A8 = new Set(Object.keys(D.cclasstrib || {}));

  function dadosBusca(partes) {
    const search = norm(partes.filter(Boolean).join(' '));
    return { search, packed: compact(search) };
  }
  function combina(consulta, alvo) {
    const lista = terms(consulta);
    if (!lista.length) return true;
    return lista.every(termo =>
      alvo.search.includes(termo) || (/\d/.test(termo) && alvo.packed.includes(compact(termo))));
  }
  function dataBr(valor) {
    if (!valor) return '';
    const p = String(valor).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(valor);
  }

  /* ---------- CFOP: NF-e e NFCom ---------- */
  let cfopDone = false;
  function montarCfop(cfg) {
    const tabela = $(cfg.tabela);
    if (!tabela) return;
    const itens = ((CFOP && CFOP.itens) || []).filter(i => (i.docs || []).includes(cfg.doc));
    const q = $(cfg.q), g = $(cfg.g), nat = $(cfg.nat);

    if (g && CFOP && CFOP.grupos) {
      g.appendChild(new Option('Todos os grupos', ''));
      Object.keys(CFOP.grupos).sort().forEach(k => {
        const nome = CFOP.grupos[k];
        g.appendChild(new Option(k + ' · ' + (nome.length > 52 ? nome.slice(0, 51) + '…' : nome), k));
      });
    }

    tabela.innerHTML = '<thead><tr><th>Código</th><th>Descrição</th><th class="th-note">Nota</th></tr></thead>';
    const corpo = el('tbody');
    const linhas = [];

    itens.forEach(item => {
      const tr = el('tr', 'cfop-row');
      const busca = dadosBusca([item.c, item.d, item.n, (CFOP.grupos || {})[item.g]]);
      tr.dataset.search = busca.search;
      tr.dataset.packed = busca.packed;

      tr.append(el('td', 'k', item.c), el('td', null, item.d));

      const celula = el('td', 'act');
      const botao = el('button', 'row-toggle', 'Nota');
      botao.type = 'button';
      botao.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-label', 'Ver a nota do CFOP ' + item.c);
      celula.appendChild(botao);
      tr.appendChild(celula);

      const detalhe = el('tr', 'detail-row');
      detalhe.hidden = true;
      const td = el('td');
      td.colSpan = 3;
      td.appendChild(el('p', 'note', item.n));
      detalhe.appendChild(td);

      const linha = { item, tr, detalhe, aberto: false };
      botao.onclick = () => {
        linha.aberto = !linha.aberto;
        detalhe.hidden = !linha.aberto;
        botao.setAttribute('aria-expanded', String(linha.aberto));
        botao.textContent = linha.aberto ? 'Fechar' : 'Nota';
      };

      corpo.append(tr, detalhe);
      linhas.push(linha);
    });
    tabela.appendChild(corpo);

    const contador = $(cfg.contador);
    const total = itens.length;
    function aplicar() {
      const consulta = q ? q.value : '';
      const grupo = g ? g.value : '';
      const natureza = nat ? nat.value : '';
      let visiveis = 0;
      linhas.forEach(linha => {
        const ok = (!grupo || linha.item.g === grupo) &&
          (!natureza || linha.item.nat === natureza) &&
          combina(consulta, { search: linha.tr.dataset.search, packed: linha.tr.dataset.packed });
        linha.tr.hidden = !ok;
        linha.detalhe.hidden = !ok || !linha.aberto;
        if (ok) visiveis++;
      });
      if (contador) {
        contador.textContent = (visiveis === total ? nf(total) : nf(visiveis) + ' de ' + nf(total)) + ' códigos';
      }
    }
    [q, g, nat].forEach(campo => {
      if (!campo) return;
      campo.addEventListener('input', aplicar);
      campo.addEventListener('change', aplicar);
    });

    const nota = $(cfg.nota);
    if (nota && CFOP && CFOP.meta) nota.textContent = cfg.notaTexto(CFOP.meta);
    aplicar();
  }

  function renderCfop() {
    if (cfopDone) return;
    cfopDone = true;
    montarCfop({
      doc: 'nfe',
      tabela: '#nfe-tbl', contador: '#nfe-count', nota: '#nfe-note',
      q: '#nfe-q', g: '#nfe-g', nat: '#nfe-nat',
      notaTexto: meta =>
        'Base: ' + meta.ajuste + ', com ' + nf(meta.total) + ' códigos. A lista da NF-e exclui os ' +
        nf(meta.nfcom) + ' códigos exclusivos de prestação de serviço de comunicação, tratados na aba NFCom.'
    });
    montarCfop({
      doc: 'nfcom',
      tabela: '#nfcom-tbl', contador: '#nfcom-count', nota: '#nfcom-note',
      q: '#nfcom-q', nat: '#nfcom-nat',
      notaTexto: meta =>
        'Fonte: MOC Online da NFCom, com ' + nf(meta.nfcom) + ' códigos. O 5.933 não consta da tabela do ' +
        meta.ajuste + ' e entra como complemento declarado, com a descrição do próprio MOC.'
    });
    montarCclass();
  }

  /* ---------- cClass: código de itens da NFCom ---------- */
  let cclassDone = false;
  function montarCclass() {
    if (cclassDone || !CCLASS) return;
    cclassDone = true;
    const tabela = $('#cclass-tbl');
    if (!tabela) return;
    const grupos = CCLASS.grupos || {};

    const seletor = $('#cclass-g');
    if (seletor) {
      seletor.appendChild(new Option('Todos os grupos', ''));
      Object.keys(grupos).sort().forEach(k => {
        seletor.appendChild(new Option(k + ' · ' + grupos[k].n, k));
      });
    }

    const TIPO = { '0': 'Não se aplica', '1': 'Continuada', '2': 'Não continuada' };
    const SELOS = [
      ['deduz', 'Deduz do total', 'tag ded'],
      ['zfm', 'CBS zero ZFM/ALC', 'tag zfm'],
      ['prePago', 'Pré-pago', 'tag'],
      ['fatCentral', 'Faturamento centralizado', 'tag'],
      ['cofat', 'Cofaturamento', 'tag']
    ];

    tabela.innerHTML = '<thead><tr><th>Código</th><th>Descrição</th><th>Grupo</th>' +
      '<th class="th-note">Indicadores</th></tr></thead>';
    const corpo = el('tbody');
    const linhas = [];

    (CCLASS.itens || []).forEach(item => {
      const grupo = grupos[item.g] || {};
      const tr = el('tr', 'cclass-row');
      const busca = dadosBusca([item.c, item.n, item.g, grupo.n, TIPO[item.t] || '']);
      tr.dataset.search = busca.search;
      tr.dataset.packed = busca.packed;

      tr.append(el('td', 'k', item.c), el('td', null, item.n),
        el('td', 'k2', item.g + ' · ' + (grupo.n || '')));

      const celula = el('td', 'act');
      SELOS.forEach(([chave, rotulo, classe]) => {
        if (grupo[chave]) celula.appendChild(el('span', classe, rotulo));
      });
      if (item.t) celula.appendChild(el('span', 'tipo', TIPO[item.t] || item.t));
      tr.appendChild(celula);

      corpo.appendChild(tr);
      linhas.push({ item, tr });
    });
    tabela.appendChild(corpo);

    const contador = $('#cclass-count');
    const total = linhas.length;
    function aplicar() {
      const consulta = ($('#cclass-q') || {}).value || '';
      const grupo = ($('#cclass-g') || {}).value || '';
      let visiveis = 0;
      linhas.forEach(linha => {
        const ok = (!grupo || linha.item.g === grupo) &&
          combina(consulta, { search: linha.tr.dataset.search, packed: linha.tr.dataset.packed });
        linha.tr.hidden = !ok;
        if (ok) visiveis++;
      });
      if (contador) {
        contador.textContent = (visiveis === total ? nf(total) : nf(visiveis) + ' de ' + nf(total)) +
          ' itens · ' + nf(Object.keys(grupos).length) + ' grupos';
      }
    }
    ['#cclass-q', '#cclass-g'].forEach(sel => {
      const campo = $(sel);
      if (!campo) return;
      campo.addEventListener('input', aplicar);
      campo.addEventListener('change', aplicar);
    });

    const nota = $('#cclass-note');
    if (nota) {
      nota.textContent = 'Fonte: ' + CCLASS.meta.fonte + ', ' + CCLASS.meta.base +
        '. O cClass identifica o item faturado; o cClassTrib, tratado na aba Reforma Tributária, ' +
        'classifica o tratamento do IBS e da CBS.';
    }
    aplicar();
  }

  /* ---------- Reforma: cClassTrib, indOp, linha do tempo ---------- */
  let refDone = false;
  let ccAplicar = null;
  let indFiltrar = null;
  let lcFiltrar = null;

  function montarLc214() {
    const box = $('#lc214');
    if (!box || !LC214) return;
    const cards = [];
    let totalItens = 0;

    (LC214.topicos || []).forEach(topico => {
      const card = el('article', 'change-card');
      const titulo = el('h3', null, topico.titulo);
      titulo.appendChild(el('span', 'tag', topico.artigos));
      card.append(titulo, el('p', null, topico.resumo || ''));

      const dl = el('dl', 'tax-facts');
      const itens = [];
      (topico.itens || []).forEach(item => {
        const linha = el('div');
        const dd = el('dd', null, item.v);
        if (item.art) dd.appendChild(el('span', 'tag', item.art));
        linha.append(el('dt', null, item.k), dd);
        linha.dataset.search = norm([item.k, item.v, item.art].join(' '));
        dl.appendChild(linha);
        itens.push(linha);
      });
      card.appendChild(dl);
      box.appendChild(card);
      cards.push({ card, itens, search: norm([topico.titulo, topico.resumo, topico.artigos].join(' ')) });
      totalItens += itens.length;
    });

    const contador = $('#lc214-count');
    lcFiltrar = () => {
      const consulta = ($('#refq') || {}).value || '';
      const busca = terms(consulta);
      let visiveis = 0;
      cards.forEach(({ card, itens, search }) => {
        const topicoCombina = !busca.length || busca.every(t => search.includes(t));
        let n = 0;
        itens.forEach(linha => {
          const ok = !busca.length || topicoCombina || busca.every(t => linha.dataset.search.includes(t));
          linha.hidden = !ok;
          if (ok) n++;
        });
        card.hidden = n === 0;
        visiveis += n;
      });
      if (contador) {
        contador.textContent = (visiveis === totalItens ? nf(totalItens) : nf(visiveis) + ' de ' + nf(totalItens)) + ' regras';
      }
    };
    lcFiltrar();

    const nota = $('#lc214-note');
    if (nota) {
      nota.textContent = 'Fonte: ' + LC214.meta.fonte + '. ' + LC214.meta.aviso;
    }
  }

  function montarCc() {
    if (!CCLASSTRIB) return;
    const cstSel = $('#cc-cst');
    if (cstSel) {
      cstSel.appendChild(new Option('Todos os CST', ''));
      (CCLASSTRIB.cst || []).forEach(c => cstSel.appendChild(new Option(c.c + ' · ' + c.n, c.c)));
    }

    const tabela = $('#cctbl');
    if (!tabela) return;
    tabela.innerHTML = '<thead><tr><th>Código</th><th>CST</th><th>Nome</th><th class="th-note">Detalhe</th></tr></thead>';
    const corpo = el('tbody');
    const linhas = [];

    (CCLASSTRIB.itens || []).forEach(item => {
      const tr = el('tr', 'cc-row');
      const busca = dadosBusca([
        item.c, item.cst, item.n, item.d, item.art, item.tipo,
        (item.docs || []).map(d => DOC_NOME[d] || d).join(' '),
        A8.has(item.c) ? 'anexo viii' : ''
      ]);
      tr.dataset.search = busca.search;
      tr.dataset.packed = busca.packed;

      const tdCodigo = el('td', 'k');
      tdCodigo.appendChild(el('span', null, item.c));
      if (A8.has(item.c)) tdCodigo.appendChild(el('span', 'tag a8', 'Anexo VIII'));
      tr.append(tdCodigo, el('td', 'k2', item.cst), el('td', null, item.n));

      const celula = el('td', 'act');
      const botao = el('button', 'row-toggle', 'Detalhe');
      botao.type = 'button';
      botao.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-label', 'Ver o detalhe do cClassTrib ' + item.c);
      celula.appendChild(botao);
      tr.appendChild(celula);

      const detalhe = el('tr', 'detail-row');
      detalhe.hidden = true;
      const td = el('td');
      td.colSpan = 4;
      const dl = el('dl', 'cc-detail');
      const add = (rotulo, valor) => {
        if (!valor) return;
        const linha = el('div');
        linha.append(el('dt', null, rotulo), el('dd', null, valor));
        dl.appendChild(linha);
      };
      add('Descrição', item.d);
      add('Fundamento na LC 214/2025', item.art);
      add('Tipo de alíquota', item.tipo);
      const reducao = [];
      if (item.ri) reducao.push('IBS ' + item.ri + '%');
      if (item.rc) reducao.push('CBS ' + item.rc + '%');
      add('Redução de alíquota', reducao.length ? reducao.join(' · ') : 'Sem redução');
      const vigencia = item.ini ? dataBr(item.ini) + (item.fim ? ' até ' + dataBr(item.fim) : ' em diante') : '';
      add('Vigência', vigencia);
      add('Documentos', (item.docs || []).map(d => DOC_NOME[d] || d).join(', '));
      td.appendChild(dl);
      detalhe.appendChild(td);

      const linha = { item, tr, detalhe, aberto: false };
      botao.onclick = () => {
        linha.aberto = !linha.aberto;
        detalhe.hidden = !linha.aberto;
        botao.setAttribute('aria-expanded', String(linha.aberto));
        botao.textContent = linha.aberto ? 'Fechar' : 'Detalhe';
      };

      corpo.append(tr, detalhe);
      linhas.push(linha);
    });
    tabela.appendChild(corpo);

    const contador = $('#cc-count');
    const total = linhas.length;
    ccAplicar = () => {
      const consulta = ($('#refq') || {}).value || '';
      const cst = ($('#cc-cst') || {}).value || '';
      const doc = ($('#cc-doc') || {}).value || '';
      const soA8 = !!($('#cc-a8') || {}).checked;
      let visiveis = 0;
      linhas.forEach(linha => {
        const ok = (!cst || linha.item.cst === cst) &&
          (!doc || (linha.item.docs || []).includes(doc)) &&
          (!soA8 || A8.has(linha.item.c)) &&
          combina(consulta, { search: linha.tr.dataset.search, packed: linha.tr.dataset.packed });
        linha.tr.hidden = !ok;
        linha.detalhe.hidden = !ok || !linha.aberto;
        if (ok) visiveis++;
      });
      if (contador) {
        contador.textContent = (visiveis === total ? nf(total) : nf(visiveis) + ' de ' + nf(total)) + ' classificações';
      }
    };
    ['#cc-cst', '#cc-doc'].forEach(sel => {
      const campo = $(sel);
      if (campo) { campo.addEventListener('input', ccAplicar); campo.addEventListener('change', ccAplicar); }
    });
    const caixa = $('#cc-a8');
    if (caixa) caixa.addEventListener('change', ccAplicar);
    ccAplicar();
  }

  function montarInd() {
    const tabela = $('#indtbl');
    if (!tabela) return;
    tabela.innerHTML = '<thead><tr><th>indOp</th><th>Local de incidência do IBS e da CBS</th></tr></thead>';
    const corpo = el('tbody');
    Object.keys(D.indop).sort().forEach(code => {
      const tr = el('tr');
      tr.append(el('td', 'k3', code), el('td', null, D.indop[code].l));
      tr.dataset.search = norm(tr.textContent);
      tr.dataset.packed = compact(tr.textContent);
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);

    const contador = $('#ind-count');
    const linhas = [...corpo.querySelectorAll('tr')];
    indFiltrar = () => {
      const consulta = ($('#refq') || {}).value || '';
      let visiveis = 0;
      linhas.forEach(tr => {
        const ok = combina(consulta, { search: tr.dataset.search, packed: tr.dataset.packed });
        tr.hidden = !ok;
        if (ok) visiveis++;
      });
      if (contador) {
        contador.textContent = (visiveis === linhas.length ? nf(linhas.length) : nf(visiveis) + ' de ' + nf(linhas.length)) + ' códigos';
      }
    };
    indFiltrar();
  }

  function renderTimeline() {
    const box = $('#tl');
    if (!box || !REFORMA) return;
    const atual = new Date().getFullYear();
    (REFORMA.linhaDoTempo || []).forEach(ano => {
      const item = el('article', 'tl-item' + (ano.ano === atual ? ' current' : ''));
      const cab = el('div', 'tl-head');
      cab.appendChild(el('span', 'tl-year', String(ano.ano)));
      cab.appendChild(el('span', 'tl-phase', ano.fase || ''));
      if (ano.ano === atual) cab.appendChild(el('span', 'tag current-tag', 'ano corrente'));
      item.appendChild(cab);

      const taxas = el('div', 'tl-rates');
      [['CBS', ano.cbs], ['IBS', ano.ibs], ['IS', ano.is]].forEach(([sigla, valor]) => {
        if (!valor) return;
        const span = el('span', 'rate');
        span.append(el('b', null, sigla), document.createTextNode(' ' + valor));
        taxas.appendChild(span);
      });
      item.appendChild(taxas);
      item.appendChild(el('p', 'tl-summary', ano.resumo || ''));

      const marcos = el('ul', 'tl-marks');
      (ano.marcos || []).forEach(m => marcos.appendChild(el('li', null, m)));
      item.appendChild(marcos);
      box.appendChild(item);
    });
  }

  function renderTributos() {
    const box = $('#tax');
    if (!box || !REFORMA) return;
    (REFORMA.tributos || []).forEach(t => {
      const card = el('article', 'tax-card');
      const cab = el('div', 'tax-head');
      cab.appendChild(el('span', 'tax-sigla', t.sigla));
      const nome = el('div');
      nome.append(el('h3', null, t.nome), el('span', 'tax-sphere', t.esfera));
      cab.appendChild(nome);
      card.appendChild(cab);

      const dl = el('dl', 'tax-facts');
      [['Substitui', t.substitui], ['Fato gerador', t.fatoGerador], ['Modelo', t.modelo], ['Quando', t.quando]]
        .forEach(([rotulo, valor]) => {
          if (!valor) return;
          const linha = el('div');
          linha.append(el('dt', null, rotulo), el('dd', null, valor));
          dl.appendChild(linha);
        });
      card.appendChild(dl);
      box.appendChild(card);
    });
  }

  function renderSubstituidos() {
    const tabela = $('#substbl');
    if (!tabela || !REFORMA) return;
    tabela.innerHTML = '<thead><tr><th>Sigla</th><th>Tributo</th><th>Fim</th><th>Observação</th></tr></thead>';
    const corpo = el('tbody');
    (REFORMA.substituidos || []).forEach(s => {
      const tr = el('tr');
      tr.append(el('td', 'k', s.sigla), el('td', null, s.nome), el('td', 'k2', s.fim || '—'), el('td', null, s.obs || ''));
      corpo.appendChild(tr);
    });
    tabela.appendChild(corpo);
  }

  function renderMudancas() {
    const box = $('#mud');
    if (!box || !REFORMA) return;
    (REFORMA.mudancas || []).forEach(m => {
      const card = el('article', 'change-card');
      card.append(el('h3', null, m.titulo), el('p', null, m.texto));
      box.appendChild(card);
    });
  }

  function renderPrazos() {
    const lista = $('#prazos');
    if (!lista || !REFORMA) return;
    (REFORMA.prazos || []).forEach(p => {
      const item = el('li', 'prazo');
      const data = el('time', 'prazo-date', dataBr(p.data));
      data.dateTime = p.data;
      const corpo = el('div', 'prazo-body');
      corpo.append(el('h3', null, p.titulo), el('p', null, p.detalhe || ''));
      item.append(data, corpo);
      lista.appendChild(item);
    });
  }

  function renderGlossario() {
    const dl = $('#gloss');
    if (!dl || !REFORMA) return;
    (REFORMA.glossario || []).forEach(g => {
      const item = el('div', 'gloss-item');
      item.append(el('dt', null, g.termo), el('dd', null, g.definicao));
      dl.appendChild(item);
    });
  }

  function renderRef() {
    if (refDone) return;
    refDone = true;
    renderTimeline();
    renderTributos();
    renderSubstituidos();
    montarLc214();
    renderMudancas();
    renderPrazos();
    montarInd();
    montarCc();
    renderGlossario();
  }

  const refq = $('#refq');
  if (refq) {
    refq.addEventListener('input', () => {
      if (indFiltrar) indFiltrar();
      if (ccAplicar) ccAplicar();
      if (lcFiltrar) lcFiltrar();
    });
  }

  const PANELS = { fluxo: '#p-fluxo', nfe: '#p-nfe', nfcom: '#p-nfcom', reforma: '#p-reforma', fontes: '#p-fontes' };
  function activateTab(t, scroll = true) {
      document.querySelectorAll('.tab').forEach(x => {
        x.setAttribute('aria-selected', String(x === t));
        x.tabIndex = x === t ? 0 : -1;
      });
      const key = t.dataset.tab;
      Object.entries(PANELS).forEach(([name, sel]) => { $(sel).hidden = name !== key; });
      document.documentElement.dataset.view = key;
      syncHeader();
      if (key === 'reforma') renderRef();
      else if (key === 'nfe' || key === 'nfcom') renderCfop();
      else if (key === 'fluxo') wireUp();
      syncUrl(key);
      if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  }
  const tabs = [...document.querySelectorAll('.tab')];
  tabs.forEach((t, index) => {
    t.onclick = () => activateTab(t);
    t.onkeydown = e => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); activateTab(next); next.focus(); }
    };
  });
  $('#open-sources').onclick = () => {
    activateTab($('#tab-fontes'), false);
    scrollToSection($('#s-fontes'));
  };

  /* ---------- navegação vinda do portal ---------- */
  function headerOffset() {
    const h = document.querySelector('header.top');
    const height = h ? Math.round(h.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--hdr', height + 'px');
    return height + 14;
  }
  function scrollToSection(dest) {
    if (!dest) return;
    const top = Math.max(0, dest.getBoundingClientRect().top + window.scrollY - headerOffset());
    window.scrollTo({ top, behavior: 'auto' });
  }
  function goto(target) {
    const name = target || 'fluxo';
    const direct = { fluxo: '#tab-fluxo', nfe: '#tab-nfe', nfcom: '#tab-nfcom', reforma: '#tab-reforma', fontes: '#tab-fontes' };
    if (direct[name]) {
      activateTab($(direct[name]), false);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const dest = document.getElementById(name);
    if (!dest) return;
    const panel = dest.closest('[role="tabpanel"]');
    const tabId = panel ? panel.getAttribute('aria-labelledby') : '';
    const tab = tabId ? document.getElementById(tabId) : null;
    if (tab) activateTab(tab, false);
    scrollToSection(dest);
  }
  window.addEventListener('message', event => {
    const data = event.data || {};
    if (data.type === 'nexo:goto') goto(data.target);
    else if (data.type === 'nexo:theme') applyTheme(data.theme, false);
  });

  /* ---------- catálogo de fontes oficiais ---------- */
  let fontesDone = false;
  function renderFontes() {
    if (fontesDone) return; fontesDone = true;
    const grid = $('#official-source-grid'), empty = $('#official-source-empty'), q = $('#official-source-q');
    const list = (FONTES && Array.isArray(FONTES.fontes)) ? FONTES.fontes : [];
    if (!grid || !list.length) { const box = $('#official-catalog'); if (box) box.hidden = true; return; }
    const note = $('#official-source-note'), foot = $('#official-source-foot');
    if (note && FONTES) {
      note.textContent = '';
      if (FONTES.criterioDeUso) note.append(el('strong', null, 'Critério de uso: '), document.createTextNode(FONTES.criterioDeUso));
      const rules = Array.isArray(FONTES.regrasDeGovernanca) ? FONTES.regrasDeGovernanca : [];
      if (rules.length) {
        const ul = el('ul', 'of-rules');
        rules.forEach(r => ul.appendChild(el('li', null, r)));
        note.appendChild(ul);
      }
    }
    if (foot && FONTES && FONTES.atualizadoEm) {
      const parts = String(FONTES.atualizadoEm).split('-');
      const date = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : FONTES.atualizadoEm;
      foot.textContent = 'Catálogo atualizado em ' + date + '. Os links abrem a publicação original; confirme os documentos antes de uso fiscal operacional.';
    }
    list.forEach(f => {
      const card = el('article', 'of-card');
      const meta = el('div', 'of-meta');
      meta.append(el('span', 'of-model', f.modelo || ''), el('span', 'of-status', f.statusConsulta || ''));
      const link = el('a', null, 'Abrir fonte oficial ↗');
      link.href = f.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      card.append(meta, el('h4', null, f.titulo || ''), el('p', null, f.detalhe || f.tipo || ''), link);
      card.dataset.search = norm([f.modelo, f.grupo, f.titulo, f.detalhe || f.tipo, f.statusConsulta].join(' '));
      grid.appendChild(card);
    });
    function applyFontes() {
      const queryTerms = terms(q ? q.value : '');
      let shown = 0;
      [...grid.children].forEach(card => {
        const text = card.dataset.search || '', packed = compact(text);
        const match = !queryTerms.length || queryTerms.every(term => text.includes(term) || packed.includes(compact(term)));
        card.hidden = !match; if (match) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    }
    if (q) q.addEventListener('input', applyFontes);
    applyFontes();
  }
  document.querySelectorAll('.jump a').forEach(a => {
    a.onclick = e => {
      e.preventDefault();
      scrollToSection(document.querySelector(a.getAttribute('href')));
    };
  });

  renderLocSel(); renderGrpSel(); renderCcSel(); apply(); renderList(); renderDetail(); renderFontes();
  const initialView = urlInicial.searchParams.get('tab');
  const initialTab = { nfe: $('#tab-nfe'), nfcom: $('#tab-nfcom'), reforma: $('#tab-reforma'), fontes: $('#tab-fontes') }[initialView] || $('#tab-fluxo');
  activateTab(initialTab, false);
})();
