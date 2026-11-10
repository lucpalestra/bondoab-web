/* BondOAB V0.1 · BondLabs */
(function () {
  'use strict';

  // ---------- configuração ----------
  var PROXIMA = { nome: '48º Exame', data: '2026-12-20T13:00:00-03:00', obs: 'data prevista da 1ª fase' };
  var DIST = [ // distribuição oficial atual (38º em diante)
    ['Ética Profissional', 8], ['Filosofia do Direito', 2], ['Direito Constitucional', 6], ['Direitos Humanos', 2],
    ['Direito Eleitoral', 2], ['Direito Internacional', 2], ['Direito Financeiro', 2], ['Direito Tributário', 5],
    ['Direito Administrativo', 5], ['Direito Ambiental', 2], ['Direito Civil', 6], ['ECA', 2],
    ['Direito do Consumidor', 2], ['Direito Empresarial', 4], ['Processo Civil', 6], ['Direito Penal', 6],
    ['Processo Penal', 6], ['Direito Previdenciário', 2], ['Direito do Trabalho', 5], ['Processo do Trabalho', 5]
  ];
  var DISCS = DIST.map(function (d) { return d[0]; });
  var BOX_DIAS = [0, 1, 3, 7, 15, 30];
  var DIA = 86400000;
  var KEY = 'bondoab.v1';

  // ---------- estado ----------
  var BANCO = null, BYID = {};
  var S = load();
  var view = null; // sessão em andamento (treino/revisão)
  var tick = null;

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.hist) return s; } catch (e) {}
    return { hist: {}, sims: [], simAtual: null, plano: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- util ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function fmtT(ms) { ms = Math.max(0, ms); var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
  function fmtData(ts) { var d = new Date(ts); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function cor(p) { return p >= 70 ? 'var(--ok)' : p >= 50 ? 'var(--gold)' : 'var(--err)'; }
  function render(html) { stopTick(); $('#app').innerHTML = html; window.scrollTo(0, 0); }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function valid(q) { return !q.anulada; }

  // ---------- histórico / repetição espaçada ----------
  function registra(q, escolha) {
    if (q.anulada) return null;
    var ok = escolha === q.g, h = S.hist[q.id] || { ok: 0, err: 0, box: 0, due: 0 };
    if (ok) { h.ok++; if (h.err > 0) { h.box = Math.min(h.box + 1, BOX_DIAS.length - 1); h.due = Date.now() + BOX_DIAS[h.box] * DIA; } }
    else { h.err++; h.box = 0; h.due = Date.now(); }
    h.last = Date.now(); h.ult = ok ? 1 : 0;
    S.hist[q.id] = h; save(); atualizaBadge();
    return ok;
  }
  function pendentes() {
    var now = Date.now();
    return BANCO.q.filter(function (q) { var h = S.hist[q.id]; return h && h.err > 0 && h.box < BOX_DIAS.length - 1 && h.due <= now; });
  }
  function emRevisao() { return BANCO.q.filter(function (q) { var h = S.hist[q.id]; return h && h.err > 0 && h.box < BOX_DIAS.length - 1; }); }
  function atualizaBadge() {
    if (!BANCO) return;
    var n = pendentes().length, b = $('#navDue');
    if (b) { b.hidden = !n; b.textContent = n; }
  }
  function statsDisc() {
    var r = {}; DISCS.forEach(function (d) { r[d] = { feitas: 0, ok: 0, total: 0 }; });
    BANCO.q.forEach(function (q) {
      if (!r[q.d]) return; r[q.d].total++;
      var h = S.hist[q.id]; if (h && (h.ok + h.err)) { r[q.d].feitas++; if (h.ult) r[q.d].ok++; }
    });
    return r;
  }

  // ---------- rotas ----------
  var ROUTES = { '': home, treino: treinoForm, simulado: simLista, sim: simRun, resultado: simResultado, revisao: revisao, desempenho: desempenho, plano: plano, fase2: fase2 };
  function route() {
    var h = location.hash.replace(/^#\/?/, '').split('/'), r = h[0] || '';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === r || (r === 'sim' && a.getAttribute('data-nav') === 'simulado')); });
    (ROUTES[r] || home)(h.slice(1));
  }

  // ---------- home ----------
  function home() {
    var falta = new Date(PROXIMA.data) - Date.now(), dias = Math.max(0, Math.ceil(falta / DIA));
    var feitas = Object.keys(S.hist).length, acertos = 0, tot = 0;
    Object.keys(S.hist).forEach(function (k) { var h = S.hist[k]; tot++; if (h.ult) acertos++; });
    var due = pendentes().length;
    render(
      '<section class="hero"><div><span class="badge gold">1ª fase · ' + BANCO.provas.length + ' provas oficiais</span>' +
      '<h1>Passe na OAB treinando com a prova de verdade.</h1>' +
      '<p>' + BANCO.q.length + ' questões do 37º ao 47º Exame, com gabarito definitivo. Treine por disciplina, faça simulados de 5 horas e revise o que errou no tempo certo.</p></div>' +
      '<div><div class="count"><div><b>' + dias + '</b><span>dias</span></div><div><b>' + Math.max(0, Math.ceil(dias / 7)) + '</b><span>semanas</span></div></div>' +
      '<p class="small" style="margin-top:8px">até o ' + PROXIMA.nome + ' (' + new Date(PROXIMA.data).toLocaleDateString('pt-BR') + ', ' + PROXIMA.obs + ')</p></div></section>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + feitas + '</b><span>questões respondidas</span></div>' +
      '<div class="stat"><b>' + pct(acertos, tot) + '%</b><span>de acerto (última tentativa)</span></div>' +
      '<div class="stat"><b>' + S.sims.length + '</b><span>simulados feitos</span></div>' +
      '<div class="stat"><b>' + due + '</b><span>para revisar agora</span></div></div>' +
      (S.simAtual ? '<div class="card" style="margin-bottom:14px"><div class="item"><div><h3>Simulado em andamento</h3><p class="muted small" style="margin:0">' + esc(S.simAtual.nome) + ' · ' + Object.keys(S.simAtual.resp).length + '/' + S.simAtual.ids.length + ' respondidas</p></div><a class="btn gold" href="#/sim">Continuar</a></div></div>' : '') +
      '<div class="grid">' +
      tile('#/treino', '🎯', 'Treinar por disciplina', 'Escolha a matéria e a prova. Correção na hora, questão por questão.') +
      tile('#/simulado', '⏱️', 'Simulados', '80 questões em 5 horas: prova completa ou simulado misto.') +
      tile('#/revisao', '🔁', 'Revisão de erros', 'Repetição espaçada: o que você errou volta em 1, 3, 7, 15 e 30 dias.', due ? '<span class="badge red">' + due + ' hoje</span>' : '') +
      tile('#/desempenho', '📊', 'Desempenho', 'Seu acerto por disciplina e o histórico dos simulados.') +
      tile('#/plano', '🗓️', 'Plano até a prova', 'Semana a semana até o ' + PROXIMA.nome + ', com peso de cada matéria.') +
      tile('#/fase2', '✍️', '2ª fase', 'Peça prático-profissional e questões discursivas com correção por IA.', '<span class="badge gold">Em breve</span>', 'soon') +
      '</div>'
    );
  }
  function tile(href, ico, t, p, badge, cls) {
    return '<a class="card tile ' + (cls || '') + '" href="' + href + '">' + (badge || '') + '<div class="ico">' + ico + '</div><h3>' + t + '</h3><p>' + p + '</p></a>';
  }

  // ---------- treino ----------
  function treinoForm() {
    var c = S.plano.treino || { d: '', ex: '', n: 10, ineditas: false };
    render(
      '<h1>Treinar por disciplina</h1><p class="muted">Correção na hora. Questões anuladas ficam de fora.</p>' +
      '<div class="card"><div class="form">' +
      '<label class="f">Disciplina<select id="fD"><option value="">Todas</option>' + DISCS.map(function (d) { return '<option' + (d === c.d ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Prova<select id="fE"><option value="">Todas (37º a 47º)</option>' + BANCO.provas.slice().reverse().map(function (p) { return '<option value="' + p.ex + '"' + (String(p.ex) === String(c.ex) ? ' selected' : '') + '>' + p.ex + 'º Exame · ' + p.data + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Quantidade<select id="fN">' + [5, 10, 20, 40].map(function (n) { return '<option' + (n == c.n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '</div><div class="row between" style="margin-top:14px"><label class="check"><input type="checkbox" id="fI"' + (c.ineditas ? ' checked' : '') + '> Só questões que nunca respondi</label>' +
      '<span class="muted small" id="fCount"></span></div>' +
      '<div class="row end" style="margin-top:14px"><button class="btn gold" id="go">Começar</button></div></div>'
    );
    function pool() {
      var d = $('#fD').value, ex = $('#fE').value, ined = $('#fI').checked;
      return BANCO.q.filter(function (q) { return valid(q) && (!d || q.d === d) && (!ex || String(q.ex) === ex) && (!ined || !S.hist[q.id]); });
    }
    function upd() { $('#fCount').textContent = pool().length + ' questões disponíveis'; }
    ['#fD', '#fE', '#fI'].forEach(function (s) { $(s).onchange = upd; }); upd();
    $('#go').onclick = function () {
      var p = pool(), n = +$('#fN').value;
      S.plano.treino = { d: $('#fD').value, ex: $('#fE').value, n: n, ineditas: $('#fI').checked }; save();
      if (!p.length) { alertBox('Nenhuma questão com esses filtros.'); return; }
      var sel = shuffle(p).slice(0, n);
      if ($('#fE').value) sel.sort(function (a, b) { return a.n - b.n; });
      sessao(sel, 'Treino' + ($('#fD').value ? ' · ' + $('#fD').value : ''), '#/treino');
    };
  }
  function alertBox(msg) { var a = document.createElement('div'); a.className = 'fb warn'; a.textContent = msg; $('#app .card').appendChild(a); setTimeout(function () { a.remove(); }, 3000); }

  // sessão de correção imediata (treino e revisão)
  function sessao(lista, titulo, voltar) {
    view = { lista: lista, i: 0, titulo: titulo, voltar: voltar, ok: 0, resp: {} };
    mostraQ();
  }
  function mostraQ() {
    var v = view, q = v.lista[v.i], r = v.resp[q.id];
    render(
      '<div class="row between"><div><h1 style="font-size:22px">' + esc(v.titulo) + '</h1></div><a class="btn ghost sm" href="' + v.voltar + '">Sair</a></div>' +
      '<div class="row between small muted" style="margin:6px 0"><span>Questão ' + (v.i + 1) + ' de ' + v.lista.length + '</span><span>' + v.ok + ' acerto(s)</span></div>' +
      '<div class="progress"><i style="width:' + pct(v.i + (r !== undefined ? 1 : 0), v.lista.length) + '%"></i></div>' +
      '<div class="card" style="margin-top:14px">' + qHtml(q, r, true) +
      '<div id="fb"></div><div class="row end" style="margin-top:16px">' +
      (v.i > 0 ? '<button class="btn ghost" id="prev">Anterior</button>' : '') +
      '<button class="btn" id="next"' + (r === undefined ? ' disabled' : '') + '>' + (v.i === v.lista.length - 1 ? 'Ver resultado' : 'Próxima') + '</button></div></div>'
    );
    if (r !== undefined) feedback(q, r);
    document.querySelectorAll('.alt').forEach(function (b) {
      b.onclick = function () {
        if (v.resp[q.id] !== undefined) return;
        var k = +b.getAttribute('data-k'); v.resp[q.id] = k;
        if (registra(q, k)) v.ok++;
        mostraQ();
      };
    });
    if ($('#prev')) $('#prev').onclick = function () { v.i--; mostraQ(); };
    $('#next').onclick = function () { if (v.i < v.lista.length - 1) { v.i++; mostraQ(); } else fimSessao(); };
  }
  function feedback(q, r) {
    var ok = r === q.g;
    $('#fb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '<b>Acertou!</b>' : '<b>Errou.</b> Gabarito: <b>' + 'ABCD'[q.g] + '</b>. Essa questão vai para a sua revisão.') + '</div>';
  }
  function fimSessao() {
    var v = view, n = v.lista.length;
    render('<div class="card center" style="padding:30px"><p class="muted">' + esc(v.titulo) + '</p><div class="score">' + v.ok + '/' + n + '</div><p>' + pct(v.ok, n) + '% de acerto</p>' +
      '<div class="row" style="justify-content:center;margin-top:14px"><a class="btn gold" href="' + v.voltar + '">Treinar de novo</a><a class="btn ghost" href="#/revisao">Ir para revisão</a><a class="btn ghost" href="#/">Início</a></div></div>');
  }

  // HTML de uma questão
  function qHtml(q, resp, mostrarGab, cortadas) {
    var h = '<div class="qhead"><span class="qnum">' + q.ex + 'º Exame · Questão ' + q.n + '</span><span class="badge">' + esc(q.d) + '</span>' + (q.anulada ? '<span class="badge red">Anulada</span>' : '') + '</div>';
    h += '<div class="stem">' + q.e.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div><div class="alts">';
    q.a.forEach(function (t, k) {
      var c = '';
      if (resp !== undefined && resp !== null) {
        if (mostrarGab && !q.anulada) { if (k === q.g) c = 'ok'; else if (k === resp) c = 'bad'; }
        else if (k === resp) c = 'sel';
      }
      if (cortadas && cortadas.indexOf(k) >= 0) c += ' cut';
      h += '<button class="alt ' + c + '" data-k="' + k + '"' + (mostrarGab && resp !== undefined && resp !== null ? ' disabled' : '') + '><span class="l">' + 'ABCD'[k] + '</span><span>' + esc(t) + '</span></button>';
    });
    return h + '</div>';
  }

  // ---------- simulados ----------
  function simLista() {
    var provas = BANCO.provas.slice().reverse();
    render(
      '<h1>Simulados</h1><p class="muted">80 questões, 5 horas, igual ao dia da prova. Para passar: <b>40 acertos</b>. Questão anulada conta ponto para todos.</p>' +
      (S.simAtual ? '<div class="card" style="margin-bottom:14px;border-color:var(--gold)"><div class="item"><div><h3>Em andamento: ' + esc(S.simAtual.nome) + '</h3><p class="muted small" style="margin:0">' + Object.keys(S.simAtual.resp).length + '/80 respondidas</p></div><div class="row"><a class="btn gold" href="#/sim">Continuar</a><button class="btn ghost sm" id="desc">Descartar</button></div></div></div>' : '') +
      '<div class="card" style="margin-bottom:14px"><div class="item"><div><h3>🎲 Simulado misto</h3><p class="muted small" style="margin:0">80 questões sorteadas das 11 provas, na distribuição oficial por disciplina. Dá preferência às que você ainda não fez.</p></div><button class="btn gold" data-sim="misto">Começar</button></div></div>' +
      '<h2>Provas completas</h2><div class="list">' +
      provas.map(function (p) {
        var feitos = S.sims.filter(function (s) { return s.tipo === String(p.ex); });
        var melhor = feitos.reduce(function (m, s) { return Math.max(m, s.pontos); }, -1);
        return '<div class="card item"><div><h3>' + p.ex + 'º Exame de Ordem</h3><p class="muted small" style="margin:0">Aplicada em ' + p.data + (melhor >= 0 ? ' · melhor nota: <b>' + melhor + '/80</b> ' + (melhor >= 40 ? '<span class="badge ok">aprovado</span>' : '<span class="badge red">abaixo de 40</span>') : '') + '</p></div><button class="btn" data-sim="' + p.ex + '">Fazer prova</button></div>';
      }).join('') + '</div>' +
      (S.sims.length ? '<h2>Histórico</h2><div class="card"><table class="t"><tr><th>Simulado</th><th>Data</th><th class="n">Nota</th><th></th></tr>' +
        S.sims.slice().reverse().map(function (s, i) { return '<tr><td>' + esc(s.nome) + '</td><td>' + fmtData(s.fim) + '</td><td class="n"><b>' + s.pontos + '</b>/80</td><td><a href="#/resultado/' + (S.sims.length - 1 - i) + '">ver</a></td></tr>'; }).join('') + '</table></div>' : '')
    );
    document.querySelectorAll('[data-sim]').forEach(function (b) {
      b.onclick = function () {
        if (S.simAtual && !confirm('Já existe um simulado em andamento. Descartar e começar outro?')) return;
        iniciaSim(b.getAttribute('data-sim'));
      };
    });
    if ($('#desc')) $('#desc').onclick = function () { if (confirm('Descartar o simulado em andamento?')) { S.simAtual = null; save(); simLista(); } };
  }
  function iniciaSim(tipo) {
    var ids, nome;
    if (tipo === 'misto') {
      ids = [];
      DIST.forEach(function (d) {
        var p = BANCO.q.filter(function (q) { return q.d === d[0] && valid(q); });
        var novas = shuffle(p.filter(function (q) { return !S.hist[q.id]; })), velhas = shuffle(p.filter(function (q) { return S.hist[q.id]; }));
        novas.concat(velhas).slice(0, d[1]).forEach(function (q) { ids.push(q.id); });
      });
      nome = 'Simulado misto';
    } else {
      ids = BANCO.q.filter(function (q) { return String(q.ex) === tipo; }).sort(function (a, b) { return a.n - b.n; }).map(function (q) { return q.id; });
      nome = tipo + 'º Exame de Ordem';
    }
    S.simAtual = { tipo: tipo, nome: nome, ids: ids, resp: {}, cort: {}, i: 0, inicio: Date.now(), dur: 5 * 3600000 };
    save(); location.hash = '#/sim';
  }
  function simRun() {
    var s = S.simAtual;
    if (!s) { location.hash = '#/simulado'; return; }
    var q = BYID[s.ids[s.i]], resp = s.resp[q.id], cort = s.cort[q.id] || [];
    render(
      '<div class="sim-layout"><div><div class="card">' + qHtml(q, resp, false, cort) +
      '<p class="muted small" style="margin:12px 0 0">Dica: clique com o botão direito (ou segure no celular) numa alternativa para riscá-la.</p>' +
      '<div class="row between" style="margin-top:16px"><button class="btn ghost" id="prev"' + (s.i === 0 ? ' disabled' : '') + '>← Anterior</button>' +
      '<button class="btn" id="next"' + (s.i === s.ids.length - 1 ? ' disabled' : '') + '>Próxima →</button></div></div></div>' +
      '<aside class="sim-side card"><div class="row between"><b>' + esc(s.nome) + '</b></div>' +
      '<div class="row between" style="margin:8px 0"><span class="muted small">Tempo restante</span><span class="timer" id="tm"></span></div>' +
      '<div class="small muted" style="margin-bottom:8px">' + Object.keys(s.resp).length + ' de ' + s.ids.length + ' respondidas</div>' +
      '<div class="qgrid">' + s.ids.map(function (id, k) { return '<button data-go="' + k + '" class="' + (s.resp[id] !== undefined ? 'done' : '') + (k === s.i ? ' cur' : '') + '">' + (k + 1) + '</button>'; }).join('') + '</div>' +
      '<button class="btn gold" id="fim" style="width:100%;margin-top:14px">Entregar prova</button></aside></div>'
    );
    function relogio() {
      var rest = s.inicio + s.dur - Date.now(), t = $('#tm');
      if (!t) return stopTick();
      t.textContent = fmtT(rest); t.classList.toggle('low', rest < 30 * 60000);
      if (rest <= 0) { stopTick(); entrega(true); }
    }
    relogio(); tick = setInterval(relogio, 1000);
    document.querySelectorAll('.alt').forEach(function (b) {
      var k = +b.getAttribute('data-k');
      b.onclick = function () { s.resp[q.id] = k; var c = s.cort[q.id]; if (c) s.cort[q.id] = c.filter(function (x) { return x !== k; }); save(); simRun(); };
      b.oncontextmenu = function (e) { e.preventDefault(); var c = s.cort[q.id] || []; s.cort[q.id] = c.indexOf(k) >= 0 ? c.filter(function (x) { return x !== k; }) : c.concat(k); save(); simRun(); };
    });
    document.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { s.i = +b.getAttribute('data-go'); save(); simRun(); }; });
    $('#prev').onclick = function () { s.i--; save(); simRun(); };
    $('#next').onclick = function () { s.i++; save(); simRun(); };
    $('#fim').onclick = function () {
      var falta = s.ids.length - Object.keys(s.resp).length;
      if (confirm(falta ? 'Faltam ' + falta + ' questões sem resposta. Entregar mesmo assim?' : 'Entregar a prova?')) entrega(false);
    };
  }
  function entrega(porTempo) {
    var s = S.simAtual; if (!s) return;
    var pontos = 0, porDisc = {}, erros = [];
    s.ids.forEach(function (id) {
      var q = BYID[id], r = s.resp[id], d = porDisc[q.d] || (porDisc[q.d] = { ok: 0, n: 0 });
      d.n++;
      if (q.anulada) { pontos++; d.ok++; return; }
      if (r !== undefined) registra(q, r);
      if (r === q.g) { pontos++; d.ok++; } else erros.push(id);
    });
    var reg = { tipo: s.tipo, nome: s.nome, ids: s.ids, resp: s.resp, pontos: pontos, porDisc: porDisc, inicio: s.inicio, fim: Date.now(), porTempo: porTempo };
    S.sims.push(reg); S.simAtual = null; save();
    location.hash = '#/resultado/' + (S.sims.length - 1);
  }
  function simResultado(args) {
    var idx = +args[0], s = S.sims[idx];
    if (!s) { location.hash = '#/simulado'; return; }
    var aprov = s.pontos >= 40, ver = args[1];
    var linhas = DISCS.filter(function (d) { return s.porDisc[d]; }).map(function (d) {
      var x = s.porDisc[d], p = pct(x.ok, x.n);
      return '<tr><td>' + d + '</td><td class="n">' + x.ok + '/' + x.n + '</td><td style="width:40%"><div class="bar"><i style="width:' + p + '%;background:' + cor(p) + '"></i></div></td></tr>';
    }).join('');
    var html = '<div class="row between"><h1>Resultado</h1><a class="btn ghost sm" href="#/simulado">Voltar</a></div>' +
      '<div class="card center" style="padding:26px"><p class="muted" style="margin-top:0">' + esc(s.nome) + ' · ' + fmtData(s.fim) + ' · tempo: ' + fmtT(s.fim - s.inicio) + (s.porTempo ? ' (acabou o tempo)' : '') + '</p>' +
      '<div class="score">' + s.pontos + '<span style="font-size:24px;color:var(--muted)">/80</span></div>' +
      '<p style="margin-bottom:0">' + (aprov ? '<span class="badge ok" style="font-size:15px">Aprovado na 1ª fase ✓</span>' : '<span class="badge red" style="font-size:15px">Faltaram ' + (40 - s.pontos) + ' acertos para os 40</span>') + '</p></div>' +
      '<h2>Por disciplina</h2><div class="card"><table class="t"><tr><th>Disciplina</th><th class="n">Acertos</th><th></th></tr>' + linhas + '</table></div>' +
      '<h2>Correção</h2><p class="muted small">Verde é o gabarito, vermelho é a sua resposta errada. Clique num número para ver a questão.</p>' +
      '<div class="card"><div class="qgrid">' + s.ids.map(function (id, k) {
        var q = BYID[id], r = s.resp[id], c = q.anulada ? 'nul' : (r === q.g ? 'ok' : 'bad');
        return '<button data-ver="' + k + '" class="' + c + (String(k) === ver ? ' cur' : '') + '">' + (k + 1) + '</button>';
      }).join('') + '</div></div>';
    if (ver !== undefined && s.ids[+ver]) {
      var q = BYID[s.ids[+ver]], r = s.resp[q.id];
      html += '<div class="card" style="margin-top:14px" id="verq">' + qHtml(q, r === undefined ? -1 : r, true) +
        '<div class="fb ' + (q.anulada ? 'warn' : r === q.g ? 'ok' : 'bad') + '">' + (q.anulada ? 'Questão anulada: ponto atribuído a todos.' : r === undefined ? 'Você deixou em branco. Gabarito: <b>' + 'ABCD'[q.g] + '</b>' : r === q.g ? 'Acertou.' : 'Você marcou <b>' + 'ABCD'[r] + '</b>. Gabarito: <b>' + 'ABCD'[q.g] + '</b>') + '</div></div>';
    }
    render(html);
    document.querySelectorAll('[data-ver]').forEach(function (b) { b.onclick = function () { location.hash = '#/resultado/' + idx + '/' + b.getAttribute('data-ver'); }; });
    if ($('#verq')) $('#verq').scrollIntoView({ block: 'start' });
  }

  // ---------- revisão ----------
  function revisao() {
    var due = pendentes(), todas = emRevisao();
    var prox = todas.filter(function (q) { return S.hist[q.id].due > Date.now(); }).sort(function (a, b) { return S.hist[a.id].due - S.hist[b.id].due; });
    render(
      '<h1>Revisão de erros</h1><p class="muted">Toda questão que você erra entra aqui. Acertou na revisão, ela volta mais tarde: 1, 3, 7, 15 e 30 dias. Errou de novo, volta para o começo. Depois de acertar 5 vezes seguidas, ela sai da revisão.</p>' +
      '<div class="stats"><div class="stat"><b>' + due.length + '</b><span>para revisar agora</span></div><div class="stat"><b>' + todas.length + '</b><span>na fila de revisão</span></div>' +
      '<div class="stat"><b>' + (prox[0] ? new Date(S.hist[prox[0].id].due).toLocaleDateString('pt-BR') : '—') + '</b><span>próxima revisão</span></div></div>' +
      (due.length ? '<div class="card item"><div><h3>' + due.length + ' questão(ões) para hoje</h3><p class="muted small" style="margin:0">Na ordem das que você errou há mais tempo.</p></div><button class="btn gold" id="go">Revisar agora</button></div>'
        : '<div class="card empty">' + (todas.length ? 'Tudo em dia. Volte quando a próxima revisão vencer.' : 'Nenhum erro para revisar ainda. Vá <a href="#/treino">treinar</a> ou faça um <a href="#/simulado">simulado</a>.') + '</div>')
    );
    if ($('#go')) $('#go').onclick = function () {
      sessao(due.sort(function (a, b) { return S.hist[a.id].due - S.hist[b.id].due; }).slice(0, 30), 'Revisão de erros', '#/revisao');
    };
  }

  // ---------- desempenho ----------
  function desempenho() {
    var st = statsDisc(), tot = 0, ok = 0;
    DISCS.forEach(function (d) { tot += st[d].feitas; ok += st[d].ok; });
    var linhas = DIST.map(function (x) {
      var d = x[0], s = st[d], p = pct(s.ok, s.feitas);
      return '<tr><td>' + d + '<div class="muted small">' + x[1] + ' questões na prova</div></td><td class="n">' + s.feitas + '/' + s.total + '</td><td class="n">' + (s.feitas ? p + '%' : '—') + '</td><td style="width:32%">' + (s.feitas ? '<div class="bar"><i style="width:' + p + '%;background:' + cor(p) + '"></i></div>' : '') + '</td><td><a class="btn ghost sm" href="#/treino" data-d="' + esc(d) + '">Treinar</a></td></tr>';
    }).join('');
    render(
      '<h1>Desempenho</h1><p class="muted">Acerto conta a última vez que você respondeu cada questão.</p>' +
      '<div class="stats"><div class="stat"><b>' + tot + '</b><span>questões feitas de ' + BANCO.q.length + '</span></div><div class="stat"><b>' + pct(ok, tot) + '%</b><span>de acerto geral</span></div>' +
      '<div class="stat"><b>' + (S.sims.length ? Math.max.apply(null, S.sims.map(function (s) { return s.pontos; })) + '/80' : '—') + '</b><span>melhor simulado</span></div></div>' +
      '<div class="card" style="overflow-x:auto"><table class="t"><tr><th>Disciplina</th><th class="n">Feitas</th><th class="n">Acerto</th><th></th><th></th></tr>' + linhas + '</table></div>' +
      '<div class="row end" style="margin-top:14px"><button class="btn ghost sm" id="reset">Apagar meu progresso</button></div>'
    );
    document.querySelectorAll('[data-d]').forEach(function (a) { a.onclick = function () { S.plano.treino = { d: a.getAttribute('data-d'), ex: '', n: 10, ineditas: false }; save(); }; });
    $('#reset').onclick = function () { if (confirm('Apagar todo o progresso deste navegador? Não dá para desfazer.')) { S = { hist: {}, sims: [], simAtual: null, plano: {} }; save(); atualizaBadge(); desempenho(); } };
  }

  // ---------- plano ----------
  function plano() {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var prova = new Date(PROXIMA.data); var dias = Math.max(0, Math.ceil((prova - hoje) / DIA));
    var semanas = Math.max(1, Math.ceil(dias / 7));
    var horas = S.plano.horas || 10;
    var st = statsDisc();
    // prioridade = peso na prova × (1 + fraqueza)
    var pri = DIST.map(function (x) {
      var s = st[x[0]], acerto = s.feitas >= 5 ? s.ok / s.feitas : 0.5;
      return { d: x[0], peso: x[1], score: x[1] * (1.5 - acerto), acerto: s.feitas >= 5 ? Math.round(acerto * 100) : null };
    }).sort(function (a, b) { return b.score - a.score; });
    var semEstudo = Math.max(1, semanas - 1); // última semana = reta final
    var blocos = [];
    for (var w = 0; w < semEstudo; w++) blocos.push([]);
    // distribui disciplinas em ordem de prioridade, em ciclos, mais peso = aparece mais vezes
    var fila = [];
    pri.forEach(function (p) { var rep = p.peso >= 5 ? 2 : 1; for (var r = 0; r < rep; r++) fila.push(p); });
    fila.forEach(function (p, k) { var b = blocos[k % semEstudo]; if (b.indexOf(p) < 0) b.push(p); });
    var qSem = Math.round(horas * 12); // ~12 questões/hora com revisão
    var html = '<h1>Plano até a prova</h1><p class="muted">Até o ' + PROXIMA.nome + ' (' + prova.toLocaleDateString('pt-BR') + ', ' + PROXIMA.obs + '). Faltam <b>' + dias + ' dias</b>. O plano dá mais tempo às matérias que mais caem e às que você mais erra.</p>' +
      '<div class="card row between"><label class="f" style="flex:1;min-width:200px">Horas de estudo por semana<input type="number" id="hrs" min="2" max="60" value="' + horas + '"></label><p class="muted small" style="flex:2;min-width:220px;margin:0">Com ' + horas + 'h por semana dá para fazer cerca de <b>' + qSem + ' questões</b> por semana, contando a revisão.</p></div>';
    var ini = new Date(hoje);
    blocos.forEach(function (b, w) {
      var a = new Date(ini.getTime() + w * 7 * DIA), z = new Date(Math.min(a.getTime() + 6 * DIA, prova.getTime() - DIA));
      var pesoTot = b.reduce(function (m, p) { return m + p.peso; }, 0) || 1;
      html += '<div class="week"><h3>Semana ' + (w + 1) + ' · ' + a.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' a ' + z.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + '</h3><ul>' +
        b.map(function (p) { return '<li><b>' + p.d + '</b>: ' + Math.max(5, Math.round(qSem * 0.75 * p.peso / pesoTot)) + ' questões' + (p.acerto !== null ? ' <span class="muted small">(seu acerto: ' + p.acerto + '%)</span>' : '') + '</li>'; }).join('') +
        '<li>Revisão de erros todos os dias (aba Revisão)</li>' + (w % 2 === 1 || semEstudo === 1 ? '<li><b>Simulado completo</b> no fim de semana (5h)</li>' : '') + '</ul></div>';
    });
    html += '<div class="week" style="border-color:var(--green)"><h3>Reta final · última semana</h3><ul><li>2 simulados completos (provas que você ainda não fez)</li><li>Zerar a fila de revisão</li><li>Reler Estatuto da OAB e Código de Ética: são 8 questões, as mais fáceis de garantir</li><li>Véspera: descanso, sem questão nova</li></ul></div>';
    render(html);
    $('#hrs').onchange = function () { var v = Math.min(60, Math.max(2, +this.value || 10)); S.plano.horas = v; save(); plano(); };
  }

  // ---------- 2ª fase ----------
  function fase2() {
    render(
      '<div class="card center" style="padding:36px 22px"><span class="badge gold" style="font-size:14px">Em breve</span>' +
      '<h1 style="margin-top:12px">2ª fase · Prova prático-profissional</h1>' +
      '<p class="muted" style="max-width:620px;margin:8px auto 0">Uma peça processual e quatro questões discursivas na área que você escolher. Vem aí:</p>' +
      '<div class="grid" style="text-align:left;margin-top:22px">' +
      '<div class="card"><h3>📝 Treino de peça</h3><p class="muted small" style="margin:0">Peças reais dos últimos exames, com o padrão de resposta oficial da FGV.</p></div>' +
      '<div class="card"><h3>🤖 Correção por IA</h3><p class="muted small" style="margin:0">A IA corrige pelo espelho da banca e o sistema confere se você citou o artigo de lei certo.</p></div>' +
      '<div class="card"><h3>⚖️ 7 áreas</h3><p class="muted small" style="margin:0">Civil, Constitucional, Trabalho, Empresarial, Penal, Tributário e Administrativo. Começa por uma.</p></div>' +
      '</div><p style="margin-top:24px"><a class="btn" href="#/simulado">Enquanto isso, garanta a 1ª fase →</a></p></div>'
    );
  }

  // ---------- boot ----------
  fetch('data/banco.json?v=0.1.1').then(function (r) { return r.json(); }).then(function (b) {
    BANCO = b; b.q.forEach(function (q) { BYID[q.id] = q; });
    if (S.simAtual && S.simAtual.ids.some(function (id) { return !BYID[id]; })) S.simAtual = null;
    atualizaBadge(); route();
  }).catch(function () { $('#app').innerHTML = '<p class="empty">Não consegui carregar as questões. Recarregue a página.</p>'; });
  window.addEventListener('hashchange', route);
})();
