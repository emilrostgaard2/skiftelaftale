/* Hele elregningen: postnummer -> netselskab -> pris i alt. Data: data/nettariffer.json (Energinet, opdateres dagligt) og data/postnr.json */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rodEl = $('[data-net-rod]') || $('#sparberegner');
  if (!rodEl) return;
  var rod = rodEl.getAttribute('data-net-rod') || rodEl.getAttribute('data-rod') || '';
  var S = window.SELSKABER || [], MOMS = 1.25, D = null, PN = null;
  var dk = function (n, d) { return (+n).toLocaleString('da-DK', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var kr = function (n) { return dk(Math.round(n)) + ' kr.'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var gemt = {}; try { gemt = JSON.parse(localStorage.getItem('mit-net')) || {}; } catch (e) {}
  var gem = function () { try { localStorage.setItem('mit-net', JSON.stringify(gemt)); } catch (e) {} };
  var mitEl = function () { try { return JSON.parse(localStorage.getItem('mit-el')) || {}; } catch (e) { return {}; } };

  function hentData() {
    if (D && PN) return Promise.resolve();
    return Promise.all([fetch(rod + 'data/nettariffer.json').then(function (r) { return r.json(); }), fetch(rod + 'data/postnr.json').then(function (r) { return r.json(); })])
      .then(function (a) { D = a[0]; PN = a[1]; });
  }
  function aboVed(p, kwh) { if (p.trin) for (var i = 0; i < p.trin.length; i++) if (p.trin[i][0] === null || kwh <= p.trin[i][0]) return p.trin[i][1]; return p.abo; }
  function selskabPris(s, kwh) {
    var b = null;
    s.produkter.forEach(function (p) {
      var a = p.tillaeg * kwh / 100 + aboVed(p, kwh) * 12 + (p.gebyr || 0) + (p.gebyr_kwh || 0) * kwh / 100;
      if (!b || a < b.aar) b = { aar: a, p: p };
    });
    return b;
  }
  function faelles(net, kwh) {
    var n = D.net[net], st = D.stat, spot = D.spot30[n.omraade];
    var dele = { spot: spot * MOMS, net: n.snit * MOMS, energinet: (st.system + st.transmission) * MOMS, afgift: st.elafgift * MOMS };
    var abo = (n.abo || 0) * MOMS;
    return { aar: (dele.spot + dele.net + dele.energinet + dele.afgift) * kwh / 100 + 12 * abo, dele: dele, abo: abo, n: n };
  }
  function netFraPostnr(pn) {
    var x = PN[pn]; if (!x) return [];
    var a = Array.isArray(x) ? x : (x.net || []);
    a = a.filter(function (k) { return D.net[k]; }); a.usikker = !Array.isArray(x) && !!x.u;
    return a;
  }
  function netValg(valgt) {
    var ks = Object.keys(D.net).sort(function (a, b) { return D.net[a].navn.localeCompare(D.net[b].navn, 'da'); });
    return '<option value="">Vælg netselskab …</option>' + ks.map(function (k) { return '<option value="' + k + '"' + (k === valgt ? ' selected' : '') + '>' + esc(D.net[k].navn) + '</option>'; }).join('');
  }
  function goLink(s, tekst, kl, pos) {
    return s.partner ? '<a class="' + kl + '" href="' + rod + 'go/' + s.slug + '/" rel="sponsored nofollow noopener" target="_blank" data-pos="' + pos + '" aria-label="' + tekst.replace(' →', '') + ' (reklamelink)">' + tekst + '</a>'
      : '<a class="' + kl + ' stille" href="' + rod + 'elselskaber/' + s.slug + '/">Læs mere</a>';
  }
  function deleHtml(f, kwh, sel) {
    var rk = [['Spotpris (seneste 30 dage)', f.dele.spot], ['Nettarif til ' + esc(f.n.navn), f.dele.net], ['Abonnement til ' + esc(f.n.navn), f.abo * 12 / kwh * 100], ['Energinets tariffer', f.dele.energinet], ['Elafgift', f.dele.afgift]];
    if (sel) rk.push(['Elselskabet (' + esc(sel.s.navn) + ')', sel.aar / kwh * 100]);
    var ialt = rk.reduce(function (a, r) { return a + r[1]; }, 0);
    return '<ul class="hr-dele">' + rk.map(function (r) { return '<li><span>' + r[0] + '</span><span class="hr-bar"><i style="width:' + Math.max(1, r[1] / ialt * 100).toFixed(1) + '%"></i></span><b class="tal">' + dk(r[1], 1) + ' øre</b></li>'; }).join('') +
      '<li class="sum"><span>I alt pr. kWh</span><span></span><b class="tal">' + dk(ialt, 1) + ' øre</b></li></ul>';
  }

  /* ---------- A: Selvstændig beregner (kWh-pris og nettarif) ---------- */
  var hr = $('#helregning');
  if (hr) {
    var kwh = +(mitEl().kwh) || 4000, net = gemt.net || '', pnInp = $('#hr-postnr', hr), sel = $('#hr-net', hr), ud = $('#hr-res', hr), info = $('#hr-info', hr), kInp = $('#hr-kwh', hr);
    var tegn = function () {
      $$('.hr-forbrug button', hr).forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.kwh === kwh ? 'true' : 'false'); });
      if (kInp && document.activeElement !== kInp) kInp.value = kwh;
      if (!net || !D.net[net]) { ud.innerHTML = '<p class="hr-tom">Skriv dit postnummer, eller vælg dit netselskab, så regner vi hele din elregning ud.</p>'; return; }
      var f = faelles(net, kwh);
      var liste = S.map(function (s) { var b = selskabPris(s, kwh); return { s: s, p: b.p, aar: b.aar, total: b.aar + f.aar }; }).sort(function (a, b) { return a.total - b.total; });
      var bp = liste.filter(function (x) { return x.s.partner; })[0], b0 = liste[0];
      var h = '<div class="hr-top"><div><span class="hr-l">Billigste elregning hos ' + esc(f.n.navn) + ' ved ' + dk(kwh) + ' kWh om året</span><b class="hr-stor">' + dk(b0.total / kwh, 2) + ' kr. pr. kWh</b><span class="hr-l">Det svarer til ' + kr(b0.total / 12) + ' om måneden i alt, hos ' + esc(b0.s.navn) + '.</span></div></div>';
      h += '<details class="hr-det" open><summary>Sådan er prisen sat sammen</summary>' + deleHtml(f, kwh, b0) + '<p class="fodnote">Spotprisen er gennemsnittet de seneste 30 dage. Nettariffen er gennemsnittet over døgnet med de tariffer, der gælder nu. Bruger du mest strøm kl. 17–21, betaler du mere. Alt er inkl. moms.</p></details>';
      if (bp) h += '<div class="hr-partner"><span class="g3-ann">Annonce</span><div><b>Billigst via os: ' + esc(bp.s.navn) + '</b><span>' + dk(bp.total / kwh, 2) + ' kr. pr. kWh i alt · ' + kr(bp.total / 12) + ' om måneden</span></div>' + goLink(bp.s, 'Se aftalen →', 'knap', 'helregning') + '</div>';
      h += '<div class="tabel-rul"><table class="stak hr-tabel"><caption>Hele elregningen hos alle ' + liste.length + ' elselskaber (' + esc(f.n.navn) + ', ' + dk(kwh) + ' kWh om året)</caption><thead><tr><th>Elselskab</th><th class="tal">Pr. kWh i alt</th><th class="tal">Pr. måned i alt</th><th class="tal">Heraf til elselskabet</th><th></th></tr></thead><tbody>' +
        liste.map(function (x, i) {
          return '<tr><th scope="row" data-label="Elselskab">' + (i + 1) + '. <a href="' + rod + 'elselskaber/' + x.s.slug + '/">' + esc(x.s.navn) + '</a><small class="gebyr">' + esc(x.p.navn) + '</small></th><td class="tal" data-label="Pr. kWh i alt"><b>' + dk(x.total / kwh, 2) + ' kr.</b></td><td class="tal" data-label="Pr. måned i alt">' + kr(x.total / 12) + '</td><td class="tal" data-label="Heraf til elselskabet">' + kr(x.aar / 12) + '</td><td data-label="">' +
            (x.s.partner ? goLink(x.s, 'Se aftalen', 'knap lille', 'helregning-tabel') + '<span class="annonce">Annonce</span>' : '<span class="np-tekst">Ingen aftale med os</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      ud.innerHTML = h;
    };
    var saetNet = function (k, fraPostnr) { net = k; gemt.net = k; gem(); if (sel) sel.value = k; tegn(); };
    hentData().then(function () {
      sel.innerHTML = netValg(net);
      if (gemt.postnr && pnInp) pnInp.value = gemt.postnr;
      pnInp.addEventListener('input', function () {
        var v = pnInp.value.replace(/\D/g, '').slice(0, 4); pnInp.value = v;
        if (v.length < 4) { info.textContent = ''; return; }
        var ks = netFraPostnr(v); gemt.postnr = v; gem();
        if (!ks.length) { info.textContent = 'Vi kender ikke netselskabet for ' + v + '. Vælg det selv på listen. Det står på din elregning.'; return; }
        info.textContent = ks.length === 1 ? (ks.usikker ? 'Vi tror, at postnummer ' + v + ' hører til ' + D.net[ks[0]].navn + ', men er ikke sikre. Tjek din elregning.' : 'Postnummer ' + v + ' hører til ' + D.net[ks[0]].navn + '. Er det forkert, kan du vælge et andet.') : 'I postnummer ' + v + ' er der flere netselskaber: ' + ks.map(function (k) { return D.net[k].navn; }).join(', ') + '. Vi har valgt det mest udbredte. Tjek din elregning.';
        saetNet(ks[0], true);
      });
      sel.addEventListener('change', function () { saetNet(sel.value); info.textContent = ''; });
      $$('.hr-forbrug button', hr).forEach(function (b) { b.addEventListener('click', function () { kwh = +b.dataset.kwh; tegn(); }); });
      if (kInp) kInp.addEventListener('input', function () { var v = +kInp.value; if (v >= 500 && v <= 30000) { kwh = v; tegn(); } });
      var m = location.hash.match(/net=([a-z0-9-]+)/); if (m && D.net[m[1]]) net = m[1], sel.value = net;
      tegn();
    }).catch(function () { ud.innerHTML = '<p class="hr-tom">Vi kunne ikke hente tariffer lige nu. Se tabellerne længere nede på siden.</p>'; });
  }

  /* ---------- B: Guiden på forsiden – hele regningen under resultatet ---------- */
  var gd = $('#sparberegner.g3');
  if (gd && S.length) {
    var visGuide = function () {
      var res = $('#g-res', gd), bedst = $('.g3-bedst', res); if (!res || !bedst) return;
      var gl = $('.g3-hel', res); if (gl) gl.remove();
      var boks = document.createElement('div'); boks.className = 'g3-hel';
      var m = mitEl(), kwh = +m.kwh || 4000;
      var tegnB = function () {
        var net = gemt.net;
        var h = '<p class="g3-hel-h">Hvad bliver hele elregningen?</p>';
        h += '<div class="g3-hel-f"><label>Dit postnummer<input type="text" inputmode="numeric" maxlength="4" autocomplete="postal-code" id="g-postnr" value="' + esc(gemt.postnr || '') + '" placeholder="fx 8000"></label><label>Netselskab<select id="g-net">' + netValg(net) + '</select></label></div>';
        if (net && D.net[net]) {
          var f = faelles(net, kwh), navn = ($('.g3-navn b', bedst) || {}).textContent;
          var bs = S.filter(function (s) { return s.navn === navn; })[0];
          if (bs) {
            var b = selskabPris(bs, kwh), tot = b.aar + f.aar, nu = null;
            if (m.gslug && m.gslug !== 'andet') { var ns = S.filter(function (s) { return s.slug === m.gslug; })[0]; if (ns) nu = selskabPris(ns, kwh).aar + f.aar; }
            h += '<p class="g3-hel-t">Hos ' + esc(bs.navn) + ' bliver hele elregningen ca. <b>' + kr(tot / 12) + ' om måneden</b> (' + dk(tot / kwh, 2) + ' kr. pr. kWh) med priserne lige nu' + (nu && nu - tot >= 12 ? ', mod ca. ' + kr(nu / 12) + ' i dag' : '') + '.</p>';
            h += '<details class="hr-det"><summary>Se hvad regningen består af</summary>' + deleHtml(f, kwh, { s: bs, aar: b.aar }) + '<p class="fodnote">Netselskab: ' + esc(f.n.navn) + '. Spotpris: gennemsnit de seneste 30 dage. Alt inkl. moms. <a href="' + rod + 'kwh-pris/#hele-regningen">Se beregningen for alle elselskaber</a>.</p></details>';
          }
        } else h += '<p class="g3-hel-t svag">Skriv dit postnummer, så lægger vi spotpris, nettarif og afgifter oveni.</p>';
        boks.innerHTML = h;
        var pi = $('#g-postnr', boks), ns2 = $('#g-net', boks);
        pi.addEventListener('input', function () {
          var v = pi.value.replace(/\D/g, '').slice(0, 4); pi.value = v; if (v.length < 4) return;
          gemt.postnr = v; var ks = netFraPostnr(v); if (ks.length) gemt.net = ks[0]; gem(); tegnB(); var p2 = $('#g-postnr', boks); if (p2 && !ks.length) p2.focus();
        });
        ns2.addEventListener('change', function () { gemt.net = ns2.value; gem(); tegnB(); });
      };
      bedst.insertAdjacentElement('afterend', boks);
      hentData().then(tegnB).catch(function () { boks.remove(); });
    };
    document.addEventListener('mit-el', visGuide);
    if (mitEl().gdone) setTimeout(visGuide, 0);
  }
})();
