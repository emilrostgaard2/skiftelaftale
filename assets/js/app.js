/* SkiftElaftale.dk – app.js (ingen afhængigheder, ingen cookies, ingen tracking) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var kr = function (n) { return Math.round(n).toLocaleString('da-DK') + ' kr.'; };
  var ore = function (n) { return (Math.round(n * 10) / 10).toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

  var tal = function (n, d) { return Number.isInteger(n) ? String(n) : n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d }); };

  /* ---------- Menu ---------- */
  var mk = $('.menu-knap'), menu = $('.menu');
  if (mk && menu) mk.addEventListener('click', function () {
    var a = menu.classList.toggle('aaben'); mk.setAttribute('aria-expanded', a ? 'true' : 'false');
  });

  /* ---------- Maskot: tryk på afbryderen ---------- */
  $$('.stikke[data-vip]').forEach(function (s) {
    var skift = function () { s.classList.toggle('taendt'); };
    s.addEventListener('click', skift);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skift(); } });
    setTimeout(function () { s.classList.add('taendt'); }, 900);
  });

  /* ---------- Beregner ---------- */
  var data = window.SELSKABER || [];
  function billigst(s, kwh) {
    var bedst = null;
    s.produkter.forEach(function (p) {
      var aar = p.tillaeg * kwh / 100 + p.abo * 12;
      if (!bedst || aar < bedst.aar) bedst = { p: p, aar: aar };
    });
    return bedst;
  }
  function rangliste(kwh) {
    return data.map(function (s) { var b = billigst(s, kwh); return { s: s, p: b.p, aar: b.aar }; })
      .sort(function (a, b) { return a.aar - b.aar || a.s.navn.localeCompare(b.s.navn, 'da'); });
  }
  var ber = $('#beregner');
  if (ber && data.length) {
    var slider = $('#forbrug'), tal = $('#forbrug-tal'), ul = $('#resultat'), spar = $('#spar-tekst');
    var rod = ber.getAttribute('data-rod') || '';
    var tegn = function () {
      var kwh = +slider.value, r = rangliste(kwh);
      tal.textContent = kwh.toLocaleString('da-DK');
      slider.setAttribute('aria-valuetext', kwh + ' kWh om året');
      ul.innerHTML = r.map(function (x, i) {
        return '<li><span class="nr">' + (i + 1) + '</span>' +
          '<img src="' + rod + 'assets/img/logos/' + x.s.logo + '" alt="' + x.s.navn + ' logo" width="92" height="30" loading="lazy">' +
          '<span class="navn"><a href="' + rod + 'elselskaber/' + x.s.slug + '/">' + x.s.navn + '</a><small>' + x.p.navn + ': ' + tal(x.p.tillaeg, 1) + ' øre/kWh + ' + tal(x.p.abo, 2) + ' kr./md.</small></span>' +
          '<span class="pris tal">' + kr(x.aar) + '<small>pr. år til elselskabet</small></span></li>';
      }).join('');
      var forskel = r[r.length - 1].aar - r[0].aar;
      if (spar) spar.innerHTML = 'Ved <b>' + kwh.toLocaleString('da-DK') + ' kWh</b> er der <b>' + kr(forskel) + '</b> om året til forskel på den billigste og den dyreste aftale i vores sammenligning.';
      $$('.typer button', ber).forEach(function (b) { b.setAttribute('aria-pressed', (+b.dataset.kwh === kwh) ? 'true' : 'false'); });
    };
    slider.addEventListener('input', tegn);
    $$('.typer button', ber).forEach(function (b) { b.addEventListener('click', function () { slider.value = b.dataset.kwh; tegn(); }); });
    tegn();
  }

  /* ---------- Live elpriser ---------- */
  var live = $('#live');
  if (live) {
    var omr = 'DK1';
    try { omr = localStorage.getItem('omraade') || 'DK1'; } catch (e) {}
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var dagStr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

    // Primær kilde: Energi Data Service (Energinet). Priser i DKK/MWh ekskl. moms.
    function hentEnerginet(omraade) {
      var i = new Date(), im = new Date(i.getTime() + 2 * 864e5);
      var url = 'https://api.energidataservice.dk/dataset/DayAheadPrices?start=' + dagStr(i) + 'T00:00&end=' + dagStr(im) + 'T00:00' +
        '&filter=' + encodeURIComponent(JSON.stringify({ PriceArea: [omraade] })) + '&sort=TimeDK%20asc&limit=400';
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var rk = (j.records || []).map(function (x) {
          var t = x.TimeDK || x.HourDK, p = x.DayAheadPriceDKK != null ? x.DayAheadPriceDKK : x.SpotPriceDKK;
          return { t: new Date(t), kr: p / 1000 };
        }).filter(function (x) { return !isNaN(x.t) && isFinite(x.kr); });
        if (!rk.length) throw new Error('Tomt svar');
        return { kilde: 'Energi Data Service (Energinet)', raekker: rk };
      });
    }
    // Fallback: elprisenligenu.dk. Priser i DKK/kWh ekskl. moms.
    function hentFallback(omraade) {
      var d = new Date();
      var url = 'https://www.elprisenligenu.dk/api/v1/prices/' + d.getFullYear() + '/' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + omraade + '.json';
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var rk = j.map(function (x) { return { t: new Date(x.time_start), kr: x.DKK_per_kWh }; });
        if (!rk.length) throw new Error('Tomt svar');
        return { kilde: 'Elprisen lige nu.dk', raekker: rk };
      });
    }
    // Saml kvarterspriser til timegennemsnit, og læg moms på
    function tilTimer(raekker) {
      var m = {};
      raekker.forEach(function (x) {
        var k = dagStr(x.t) + ' ' + pad(x.t.getHours());
        (m[k] = m[k] || { t: new Date(x.t.getFullYear(), x.t.getMonth(), x.t.getDate(), x.t.getHours()), sum: 0, n: 0 });
        m[k].sum += x.kr; m[k].n++;
      });
      return Object.keys(m).sort().map(function (k) { return { t: m[k].t, ore: m[k].sum / m[k].n * 100 * 1.25 }; });
    }
    function vis(res) {
      var timer = tilTimer(res.raekker), nu = new Date(), idag = dagStr(nu);
      var dag = timer.filter(function (x) { return dagStr(x.t) === idag; });
      if (!dag.length) dag = timer.slice(0, 24);
      var v = dag.map(function (x) { return x.ore; });
      var min = Math.min.apply(0, v), max = Math.max.apply(0, v), snit = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
      var nuT = dag.filter(function (x) { return x.t.getHours() === nu.getHours(); })[0] || dag[0];
      var minT = dag[v.indexOf(min)], maxT = dag[v.indexOf(max)];
      var saet = function (id, val) { var e = $(id); if (e) e.textContent = val; };
      saet('#pris-nu', ore(nuT.ore)); saet('#pris-snit', ore(snit));
      saet('#pris-min', ore(min)); saet('#pris-max', ore(max));
      saet('#tid-min', 'kl. ' + pad(minT.t.getHours()) + '–' + pad((minT.t.getHours() + 1) % 24));
      saet('#tid-max', 'kl. ' + pad(maxT.t.getHours()) + '–' + pad((maxT.t.getHours() + 1) % 24));
      var graf = $('#graf');
      if (graf) {
        var top = Math.max(max, 1), bund = Math.min(min, 0), span = top - bund || 1;
        var lavG = min + (max - min) * 0.33, hojG = min + (max - min) * 0.72;
        graf.innerHTML = dag.map(function (x, i) {
          var h = Math.max(3, (x.ore - bund) / span * 100);
          var kl = x.ore <= lavG ? ' lav' : (x.ore >= hojG ? ' hoj' : '');
          if (x.t.getHours() === nu.getHours()) kl += ' nu';
          return '<div class="s' + kl + '" tabindex="0" style="height:' + h.toFixed(1) + '%;animation-delay:' + (i * 18) + 'ms" data-t="kl. ' + pad(x.t.getHours()) + ': ' + ore(x.ore) + ' øre"></div>';
        }).join('');
        graf.setAttribute('aria-label', 'Spotpris time for time i dag i ' + omr + '. Lavest ' + ore(min) + ' øre, højest ' + ore(max) + ' øre pr. kWh inkl. moms.');
      }
      var imorgen = timer.filter(function (x) { return dagStr(x.t) > idag; });
      var im = $('#imorgen');
      if (im) im.textContent = imorgen.length >= 20
        ? 'I morgen ligger gennemsnittet på ' + ore(imorgen.reduce(function (a, b) { return a + b.ore; }, 0) / imorgen.length) + ' øre/kWh inkl. moms.'
        : 'Morgendagens priser offentliggøres normalt omkring kl. 13.';
      saet('#kilde', res.kilde);
      saet('#hentet', 'kl. ' + pad(nu.getHours()) + '.' + pad(nu.getMinutes()));
      live.classList.add('klar');
    }
    function fejl() {
      var graf = $('#graf');
      if (graf && graf.hasAttribute('hidden')) { var sek = live.closest('section'); if (sek) sek.hidden = true; return; }
      if (graf) graf.innerHTML = '<p class="graf-fejl">Vi kan ikke hente dagens priser lige nu. Prøv at genindlæse siden om lidt – eller se priserne direkte hos <a href="https://www.energidataservice.dk/" rel="noopener">Energi Data Service</a>.</p>';
    }
    function hent() {
      $$('.omraade button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.o === omr ? 'true' : 'false'); });
      hentEnerginet(omr).catch(function () { return hentFallback(omr); }).then(vis).catch(fejl);
    }
    $$('.omraade button').forEach(function (b) { b.addEventListener('click', function () {
      omr = b.dataset.o; try { localStorage.setItem('omraade', omr); } catch (e) {} hent();
    }); });
    hent();
  }

  /* ---------- Indholdsfortegnelse: markér aktiv sektion ---------- */
  var links = $$('.indhold a');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (l) { l.classList.remove('aktiv'); }); if (map[e.target.id]) map[e.target.id].classList.add('aktiv'); } });
    }, { rootMargin: '-15% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- Mobil-CTA: vis efter lidt scroll ---------- */
  var cta = $('.mobil-cta');
  if (cta) window.addEventListener('scroll', function () { cta.classList.toggle('vis', window.scrollY > 700); }, { passive: true });
})();
