/* Rangliste på forsiden (v22) */
(function () {
  var S = window.SELSKABER, rk = document.getElementById('hh-rk'); if (!S || !rk) return;
  var SC = window.SCORE || {}, nu = document.getElementById('hh-nu'), kwh = 4000;
  var da = function (n) { return Math.round(n).toLocaleString('da-DK'); };
  var kom = function (n) { return String(n).replace('.', ','); };
  var abo = function (p, k) { if (p.trin) for (var i = 0; i < p.trin.length; i++) { if (p.trin[i][0] == null || k <= p.trin[i][0]) return p.trin[i][1]; } return p.abo || 0; };
  var bedst = function (s, k) { var b = null; s.produkter.forEach(function (p) { var v = p.tillaeg * k / 100 + 12 * abo(p, k) + (p.gebyr || 0) + (p.gebyr_kwh || 0) * k / 100; if (!b || v < b.v) b = { v: v, p: p }; }); return b; };
  var stj = function (tp) { var n = tp ? Math.round(tp) : 0, h = '<span class="hh-st" aria-hidden="true">'; for (var i = 0; i < 5; i++) h += i < n ? '<i class="on"></i>' : '<i></i>'; return h + '</span>'; };
  var navne = { 2000: 'en lejlighed', 3000: 'et rækkehus', 4000: 'et hus', 8000: 'et hus med elbil' };
  function tegn() {
    var L = S.filter(function (s) { return s.partner; }).map(function (s) { return { s: s, b: bedst(s, kwh) }; }).sort(function (a, b) { return a.b.v - b.b.v; }).slice(0, 5);
    var tpmax = Math.max.apply(null, L.map(function (x) { return x.s.tp || 0; }));
    var min = null; if (nu && nu.value) S.forEach(function (s) { if (s.slug === nu.value) min = bedst(s, kwh).v; });
    rk.innerHTML = L.map(function (x, i) {
      var s = x.s, p = x.b.p, sc = SC[s.slug];
      var tag = i === 0 ? '<span class="hh-tag">Billigste partner</span>' : ((s.tp || 0) === tpmax ? '<span class="hh-tag">Bedst bedømt af kunderne</span>' : '');
      var tp = s.tp ? stj(s.tp) + ' Trustpilot ' + kom(s.tp) + (s.tpn ? ' (' + da(s.tpn) + ')' : '') : stj(0) + ' Ingen bedømmelser endnu';
      var spar = '';
      if (min != null) { var d = Math.round(min - x.b.v); spar = s.slug === nu.value ? '<span class="hh-spar neutral">Dit selskab i dag</span>' : (d > 0 ? '<span class="hh-spar">Spar ' + da(d) + ' kr. om året</span>' : '<span class="hh-spar neutral">' + da(-d) + ' kr. dyrere end i dag</span>'); }
      return '<li class="hh-r" data-slug="' + s.slug + '"><span class="hh-med">' + (i + 1) + '</span><a class="hh-logo" href="elselskaber/' + s.slug + '/"><img src="assets/img/logos/' + s.logo + '" alt="' + s.navn + '" width="135" height="32"></a>' +
        '<div class="hh-inf">' + tag + '<h3>' + s.navn + ': ' + p.navn + ' <span class="hh-an">Annonce</span></h3><p>' + kom(p.tillaeg) + ' øre/kWh i tillæg, ' + kom(abo(p, kwh)) + ' kr./md., ' + (s.binding ? s.binding + ' mdr. binding' : 'ingen binding') + '</p><p class="hh-tp">' + tp + '</p></div>' +
        (sc ? '<a class="hh-sc" href="elselskaber/' + s.slug + '/" style="--p:' + Math.round(parseFloat(sc.replace(',', '.')) * 10) + '%" aria-label="Vores score for ' + s.navn + ': ' + sc + ' af 10"><b>' + sc + '</b></a>' : '<span></span>') +
        '<div class="hh-pr"><b class="tal">' + da(x.b.v) + ' kr.</b><small>om året til elselskabet</small>' + spar + '</div>' +
        '<div class="hh-cta"><a class="knap hh-kn" href="go/' + s.slug + '/" rel="sponsored nofollow noopener" target="_blank" data-pos="forside-rang" aria-label="Se aftalen hos ' + s.navn + ' (reklamelink)">Se aftale</a><a class="hh-anm" href="elselskaber/' + s.slug + '/">Anmeldelse af ' + s.navn + '</a></div></li>';
    }).join('');
    var alle = S.map(function (s) { return { s: s, b: bedst(s, kwh) }; }).sort(function (a, b) { return a.b.v - b.b.v; })[0], note = document.getElementById('hh-note');
    if (note) note.innerHTML = alle.s.partner ? '' : 'Billigst i hele markedet ved ' + da(kwh) + ' kWh er <a href="elselskaber/' + alle.s.slug + '/">' + alle.s.navn + '</a> med ' + da(alle.b.v) + ' kr. om året. Vi samarbejder ikke med ' + alle.s.navn + ', så selskabet står ikke på listen her. ';
    var t = document.getElementById('hh-kwh-t'); if (t) t.textContent = 'Priser for ' + navne[kwh] + ' med ' + da(kwh) + ' kWh om året';
  }
  var kn = [].slice.call(document.querySelectorAll('.hh-faner button'));
  kn.forEach(function (b) { b.addEventListener('click', function () { kwh = +b.dataset.kwh; kn.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); tegn(); }); });
  if (nu) { try { var m = JSON.parse(localStorage.getItem('mit-el')); if (m && m.gslug) nu.value = m.gslug; } catch (e) {} nu.addEventListener('change', tegn); if (nu.value) tegn(); }
})();
