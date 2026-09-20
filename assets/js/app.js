/* SkiftElaftale.dk – app.js (ingen afhængigheder, ingen cookies, ingen tracking) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var kr = function (n) { return Math.round(n).toLocaleString('da-DK') + ' kr.'; };
  var ore = function (n) { return (Math.round(n * 10) / 10).toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

  var fmt = function (n, d) { return Number.isInteger(n) ? String(n) : n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d }); };

  /* ---------- Menu ---------- */
  var mk = $('.menu-knap'), menu = $('.menu');
  if (mk && menu) mk.addEventListener('click', function () {
    var a = menu.classList.toggle('aaben'); mk.setAttribute('aria-expanded', a ? 'true' : 'false');
  });

  /* ---------- Maskot: tryk på Stikke -> lyset tænder, og vi ruller ned til beregneren ---------- */
  $$('.stikke[data-vip]').forEach(function (s) {
    var rolig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tryk = function () {
      var varTaendt = s.classList.contains('taendt');
      s.classList.add('taendt');
      var maal = document.getElementById('beregner');
      if (!maal) return;
      setTimeout(function () {
        maal.scrollIntoView({ behavior: rolig ? 'auto' : 'smooth', block: 'start' });
        var sl = document.getElementById('forbrug'); if (sl) setTimeout(function () { sl.focus({ preventScroll: true }); }, 700);
      }, varTaendt ? 0 : 650);
    };
    s.addEventListener('mousedown', function (e) { e.preventDefault(); }); // ingen fokusramme ved museklik
    s.addEventListener('click', tryk);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryk(); } });
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
          '<span class="navn"><a href="' + rod + 'elselskaber/' + x.s.slug + '/">' + x.s.navn + '</a><small>' + x.p.navn + ': ' + fmt(x.p.tillaeg, 1) + ' øre/kWh + ' + fmt(x.p.abo, 2) + ' kr./md.</small></span>' +
          '<span class="pris tal">' + kr(x.aar) + '<small>pr. år til elselskabet</small></span>' +
          '<a class="knap" href="' + rod + 'go/' + x.s.slug + '/" rel="sponsored nofollow noopener" target="_blank" data-pos="beregner" aria-label="Se aftalen hos ' + x.s.navn + ' (reklamelink)">Se aftalen</a></li>';
      }).join('');
      var forskel = r[r.length - 1].aar - r[0].aar;
      if (spar) spar.innerHTML = 'Ved <b>' + kwh.toLocaleString('da-DK') + ' kWh</b> er der <b>' + kr(forskel) + '</b> om året til forskel på den billigste og den dyreste aftale i vores sammenligning.';
      $$('.typer button', ber).forEach(function (b) { b.setAttribute('aria-pressed', (+b.dataset.kwh === kwh) ? 'true' : 'false'); });
    };
    slider.addEventListener('input', tegn);
    $$('.typer button', ber).forEach(function (b) { b.addEventListener('click', function () { slider.value = b.dataset.kwh; tegn(); }); });
    tegn();
  }


  /* ---------- Indholdsliste: lukket på mobil ---------- */
  if (window.innerWidth < 820) $$('details.toc').forEach(function (d) { d.removeAttribute('open'); });

  /* ---------- Filtre på rangtabeller ---------- */
  $$('.rang-blok').forEach(function (blok) {
    var knapper = $$('.filtre button', blok), rk = $$('tbody tr', blok);
    if (!knapper.length) return;
    var test = { binding: function (r) { return r.dataset.binding === '0'; }, bagud: function (r) { return r.dataset.bagud === '1'; },
      abo: function (r) { return +r.dataset.abo === 0; }, tillaeg: function (r) { return +r.dataset.tillaeg === 0; } };
    knapper.forEach(function (b) { b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      var aktive = knapper.filter(function (k) { return k.getAttribute('aria-pressed') === 'true'; }).map(function (k) { return k.dataset.f; });
      var synlige = 0;
      rk.forEach(function (r) { if (r.classList.contains('tom-raekke')) return; var ok = aktive.every(function (f) { return test[f](r); }); r.hidden = !ok; if (ok) synlige++; });
      var tom = $('.tom-raekke', blok);
      if (!synlige && !tom) { tom = document.createElement('tr'); tom.className = 'tom-raekke'; tom.innerHTML = '<td colspan="7">Ingen aftaler opfylder alle de valgte filtre. Slå et filter fra.</td>'; $('tbody', blok).appendChild(tom); }
      if (tom) tom.hidden = synlige > 0;
    }); });
  });

  /* ---------- Spar-beregner ---------- */
  var spar = $('#spar');
  if (spar && data.length) {
    var fk = $('#sp-kwh'), ft = $('#sp-til'), fa = $('#sp-abo'), ud = $('#sp-tal'), tx = $('#sp-tekst'), kn = $('#sp-knap'), srod = spar.getAttribute('data-rod') || '', vist = 0, raf;
    var taelOp = function (til) {
      cancelAnimationFrame(raf); var fra = vist, t0 = null;
      var trin = function (t) { if (!t0) t0 = t; var f = Math.min(1, (t - t0) / 500); vist = fra + (til - fra) * (1 - Math.pow(1 - f, 3)); ud.textContent = kr(vist) ; if (f < 1) raf = requestAnimationFrame(trin); };
      raf = requestAnimationFrame(trin);
    };
    var regn = function () {
      var kwh = Math.max(0, +fk.value || 0), nu = (+ft.value || 0) * kwh / 100 + (+fa.value || 0) * 12, b = rangliste(kwh)[0], forskel = nu - b.aar;
      if (forskel > 0) { taelOp(forskel); tx.innerHTML = 'om året ved at skifte til <b style="font:inherit;color:#fff;font-weight:700">' + b.s.navn + '</b>. Du betaler ' + kr(nu) + ' til dit elselskab i dag. Hos ' + b.s.navn + ' ville det være ' + kr(b.aar); kn.style.display = ''; kn.textContent = 'Gå til ' + b.s.navn; kn.href = srod + 'go/' + b.s.slug + '/'; }
      else { cancelAnimationFrame(raf); vist = 0; ud.textContent = '0 kr.'; tx.textContent = 'Din aftale er allerede billigere end alle i vores sammenligning. Bliv, hvor du er.'; kn.style.display = 'none'; }
    };
    [fk, ft, fa].forEach(function (f) { f.addEventListener('input', regn); }); regn();
  }

  /* ---------- Live elpriser ---------- */
  var live = $('#live');
  if (live) {
    var omr = 'DK1';
    try { omr = localStorage.getItem('omraade') || 'DK1'; } catch (e) {}
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var dagStr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

    // fetch med timeout, så en kilde der hænger ikke blokerer fallback
    function hentJson(url) {
      var c = ('AbortController' in window) ? new AbortController() : null;
      var t = setTimeout(function () { if (c) c.abort(); }, 8000);
      return fetch(url, c ? { signal: c.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    // Primær kilde: Energi Data Service (Energinet). Priser i DKK/MWh ekskl. moms.
    function hentEnerginet(omraade) {
      var i = new Date(), im = new Date(i.getTime() + 2 * 864e5);
      var url = 'https://api.energidataservice.dk/dataset/DayAheadPrices?start=' + dagStr(i) + 'T00:00&end=' + dagStr(im) + 'T00:00' +
        '&filter=' + encodeURIComponent(JSON.stringify({ PriceArea: [omraade] })) + '&sort=TimeDK%20asc&limit=400';
      return hentJson(url).then(function (j) {
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
      return hentJson(url).then(function (j) {
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
