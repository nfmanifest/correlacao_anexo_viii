// Correlação NFS — consulta do Anexo VIII em página estática, sem dependências.
// Os dados vêm de data/anexo8.json, gerado por ../build/gerar.py.
(async () => {
  const UI_VERSION = '2026-09-19.3';
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
      const resposta = await fetch('data/anexo8.json?v=' + encodeURIComponent(UI_VERSION));
      if (!resposta.ok) throw new Error('Falha ao carregar os dados');
      D = await resposta.json();
    } catch (erro) {
      showLoadError();
      return;
    }
  }

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
          const cc = D.cclass[c] || {};
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
    if ((tab || url.searchParams.get('tab')) === 'ref') url.searchParams.set('tab', 'ref');
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
    Object.keys(D.cclass).sort().forEach(c => {
      const nome = D.cclass[c].n;
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
    share.onclick = () => { syncUrl(); copyText(window.location.href, 'Link da consulta copiado'); };
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
            const o = D.cclass[c] || {}, n = el('div', 'cc');
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
  const publicacaoCclass = D.meta.fonte_cc_publicacao
    ? D.meta.fonte_cc_publicacao.split('-').reverse().join('/')
    : null;
  $('#source-cclass').textContent = D.meta.fonte_cc +
    (publicacaoCclass ? ' · publicada em ' + publicacaoCclass : '') +
    (D.meta.fonte_cc_total ? ' · ' + nf(D.meta.fonte_cc_total) + ' códigos' : '');
  $('#foot').textContent =
    'Fonte: ' + D.meta.fonte_anexo + ', a aba REGRA inc. X do mesmo arquivo e ' + D.meta.fonte_cc + '. ' +
    'Esta consulta reproduz o Anexo VIII ' + D.meta.versao + ' e preserva os códigos indOp do Anexo VII v1.01.00 usados na correlação original. ' +
    'A NT 009/2026 publicou o Anexo VII v1.02.00; não houve nova publicação correspondente do Anexo VIII nesta base. ' +
    'Lacunas da planilha aparecem marcadas em vermelho no fluxo.';

  /* ---------- tabelas de apoio ---------- */
  let refDone = false;
  function filterRef() {
    if (!refDone) return;
    const query = $('#refq').value.trim();
    const filterTable = (table, count, noun) => {
      const rows = [...table.querySelectorAll('tbody tr')];
      let visible = 0;
      rows.forEach(row => {
        const show = !query || terms(query).every(term => {
          const packedTerm = compact(term);
          return row.dataset.search.includes(term) || (packedTerm && row.dataset.packed.includes(packedTerm));
        });
        row.hidden = !show; if (show) visible++;
      });
      count.textContent = query ? visible + ' de ' + rows.length + ' ' + noun : rows.length + ' ' + noun;
    };
    filterTable($('#indtbl'), $('#ind-count'), 'códigos');
    filterTable($('#cctbl'), $('#cc-count'), 'classificações');
  }
  function renderRef() {
    if (refDone) return; refDone = true;

    const it = $('#indtbl');
    it.innerHTML = '<thead><tr><th>indOp</th><th>Local de incidência do IBS e da CBS</th></tr></thead>';
    const ib = el('tbody');
    Object.keys(D.indop).sort().forEach(code => {
      const tr = el('tr');
      tr.append(el('td', 'k3', code), el('td', null, D.indop[code].l));
      tr.dataset.search = norm(tr.textContent); tr.dataset.packed = compact(tr.textContent);
      ib.appendChild(tr);
    });
    it.appendChild(ib);

    const t = $('#cctbl');
    t.innerHTML = '<thead><tr><th>cClassTrib</th><th>CST</th><th>Tratamento</th><th>Nome</th><th>LC 214/25</th></tr></thead>';
    const tb = el('tbody');
    Object.keys(D.cclass).sort().forEach(code => {
      const o = D.cclass[code], tr = el('tr');
      tr.append(el('td', 'k', code), el('td', 'k2', o.cst || '—'), el('td', null, o.dcst || '—'),
                el('td', null, o.n), el('td', 'k2', o.art || '—'));
      tr.dataset.search = norm(tr.textContent); tr.dataset.packed = compact(tr.textContent);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    filterRef();
  }
  $('#refq').addEventListener('input', filterRef);

  function activateTab(t, scroll = true) {
      document.querySelectorAll('.tab').forEach(x => {
        x.setAttribute('aria-selected', String(x === t));
        x.tabIndex = x === t ? 0 : -1;
      });
      $('#p-fluxo').hidden = t.dataset.tab !== 'fluxo';
      $('#p-ref').hidden = t.dataset.tab !== 'ref';
      if (t.dataset.tab === 'ref') renderRef(); else wireUp();
      syncUrl(t.dataset.tab);
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const refTab = $('#tab-ref'); activateTab(refTab, false);
    requestAnimationFrame(() => $('#s-fontes').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  document.querySelectorAll('.jump a').forEach(a => {
    a.onclick = e => {
      e.preventDefault();
      const el2 = document.querySelector(a.getAttribute('href'));
      if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });

  renderLocSel(); renderGrpSel(); renderCcSel(); apply(); renderList(); renderDetail();
  const initialTab = urlInicial.searchParams.get('tab') === 'ref' ? $('#tab-ref') : $('#tab-fluxo');
  activateTab(initialTab, false);
})();
