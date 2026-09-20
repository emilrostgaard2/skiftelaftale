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
  var spar = $('#sparberegner');
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
      var t = setTimeout(function () { if (c) c.abort(); }, 15000);
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
    // Reservekilde, hvis Energinet ikke svarer. Priser i DKK/kWh ekskl. moms.
    function hentReserve(omraade) {
      var d = new Date(), im = new Date(d.getTime() + 864e5);
      var u = function (x) { return 'https://www.elprisenligenu.dk/api/v1/prices/' + x.getFullYear() + '/' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()) + '_' + omraade + '.json'; };
      var tilRk = function (j) { return j.map(function (x) { return { t: new Date(x.time_start), kr: x.DKK_per_kWh }; }); };
      return hentJson(u(d)).then(function (j) {
        var rk = tilRk(j); if (!rk.length) throw new Error('Tomt svar');
        return hentJson(u(im)).then(function (j2) { return rk.concat(tilRk(j2)); }).catch(function () { return rk; });
      }).then(function (rk) { return { kilde: 'Elprisen lige nu.dk (reservekilde)', raekker: rk }; });
    }
    // Lokal kopi af seneste svar, så siden aldrig står tom, hvis begge kilder driller
    function gem(o, res) { try { localStorage.setItem('elpris-' + o, JSON.stringify({ d: dagStr(new Date()), k: res.kilde, r: res.raekker.map(function (x) { return [x.t.getTime(), x.kr]; }) })); } catch (e) {} }
    function laes(o) { try { var c = JSON.parse(localStorage.getItem('elpris-' + o)); if (c && c.d === dagStr(new Date())) return { kilde: c.k + ' (gemt kopi)', raekker: c.r.map(function (x) { return { t: new Date(x[0]), kr: x[1] }; }) }; } catch (e) {} return null; }
    var vent = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

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
    var visDag = 'idag', sidste = null;
    function vis(res) {
      sidste = res;
      var timer = tilTimer(res.raekker), nu = new Date(), idag = dagStr(nu);
      var dagIdag = timer.filter(function (x) { return dagStr(x.t) === idag; });
      var dagImorgen = timer.filter(function (x) { return dagStr(x.t) > idag; }).slice(0, 25);
      var harImorgen = dagImorgen.length >= 20;
      var bm = $('#dag-imorgen'); if (bm) { bm.disabled = !harImorgen; bm.title = harImorgen ? '' : 'Offentliggøres ca. kl. 13'; }
      if (visDag === 'imorgen' && !harImorgen) visDag = 'idag';
      $$('.dagvalg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.d === visDag ? 'true' : 'false'); });
      var erIdag = visDag === 'idag';
      var dag = erIdag ? dagIdag : dagImorgen;
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
          if (erIdag && x.t.getHours() === nu.getHours()) kl += ' nu';
          return '<div class="s' + kl + '" tabindex="0" style="height:' + h.toFixed(1) + '%;animation-delay:' + (i * 18) + 'ms" data-t="kl. ' + pad(x.t.getHours()) + ': ' + ore(x.ore) + ' øre"></div>';
        }).join('');
        graf.setAttribute('aria-label', 'Spotpris time for time i dag i ' + omr + '. Lavest ' + ore(min) + ' øre, højest ' + ore(max) + ' øre pr. kWh inkl. moms.');
      }
      var imorgen = timer.filter(function (x) { return dagStr(x.t) > idag; });
      var im = $('#imorgen');
      if (im) im.textContent = imorgen.length >= 20
        ? 'I morgen ligger gennemsnittet på ' + ore(imorgen.reduce(function (a, b) { return a + b.ore; }, 0) / imorgen.length) + ' øre/kWh inkl. moms.'
        : 'Morgendagens priser offentliggøres normalt omkring kl. 13.';
      // Tabel time for time
      var tb = $('#timetabel');
      if (tb) {
        var cap = $('#tt-cap'); if (cap) cap.textContent = 'Spotpris time for time ' + (erIdag ? 'i dag' : 'i morgen') + ', ' + (omr === 'DK1' ? 'Vestdanmark (DK1)' : 'Østdanmark (DK2)');
        tb.innerHTML = dag.map(function (x) {
          var d = x.ore - snit, niv = x.ore <= min + (max - min) * 0.33 ? ['gron', 'Billig'] : (x.ore >= min + (max - min) * 0.72 ? ['rod', 'Dyr'] : ['', 'Middel']);
          var erNu = erIdag && x.t.getHours() === nu.getHours();
          return '<tr' + (erNu ? ' class="vinder"' : '') + '><th scope="row" data-label="Time">kl. ' + pad(x.t.getHours()) + '–' + pad((x.t.getHours() + 1) % 24) + (erNu ? ' <span class="maerke gul">Nu</span>' : '') + '</th>' +
            '<td class="tal" data-label="Spotpris inkl. moms"><b>' + ore(x.ore) + ' øre</b></td><td class="tal" data-label="Mod døgnets snit">' + (d >= 0 ? '+' : '−') + ore(Math.abs(d)) + ' øre</td>' +
            '<td data-label="Niveau"><span class="maerke ' + niv[0] + '">' + niv[1] + '</span></td></tr>';
        }).join('');
      }
      // Billigste sammenhængende timer (kun fremtidige timer, når vi ser på i dag)
      var vu = $('#vinduer');
      if (vu) {
        var fra = erIdag ? dagIdag.filter(function (x) { return x.t.getHours() >= nu.getHours(); }).concat(harImorgen ? dagImorgen : []) : dag;
        var bedst = function (n) { var b = null; for (var i = 0; i + n <= fra.length; i++) { var sum = 0; for (var j = 0; j < n; j++) sum += fra[i + j].ore; if (!b || sum < b.sum) b = { i: i, sum: sum }; } return b; };
        vu.innerHTML = [[2, 'Vask eller opvask (2 timer)'], [4, 'Tørretumbler + vask (4 timer)'], [6, 'Opladning af elbil (6 timer)']].map(function (v) {
          var b = bedst(v[0]); if (!b) return '<li><span>' + v[1] + '</span><b>Vent på morgendagens priser (ca. kl. 13)</b></li>';
          var st = fra[b.i].t.getHours(), sl = (fra[b.i + v[0] - 1].t.getHours() + 1) % 24;
          return '<li><span>' + v[1] + '</span><b class="tal">' + (erIdag && dagStr(fra[b.i].t) > idag ? 'i morgen ' : '') + 'kl. ' + pad(st) + '–' + pad(sl) + '</b><small>snit ' + ore(b.sum / v[0]) + ' øre/kWh</small></li>';
        }).join('');
      }
      var ek = $('#eksempler');
      if (ek) {
        var nuPris = (erIdag ? nuT.ore : snit) / 100, fmtKr = function (n) { return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr.'; };
        ek.innerHTML = [['En vask (0,8 kWh)', 0.8], ['En opvask (1 kWh)', 1], ['En tur i tørretumbleren (2 kWh)', 2], ['Opladning af elbil (40 kWh)', 40]].map(function (x) {
          return '<li><span>' + x[0] + '</span><b class="tal">' + fmtKr(x[1] * nuPris) + '</b><small>billigst i dag: ' + fmtKr(x[1] * min / 100) + '</small></li>'; }).join('');
      }
      try { document.dispatchEvent(new CustomEvent('elpris', { detail: { nu: nuT.ore, min: min, max: max, snit: snit } })); } catch (e) {}
      
      saet('#hentet', 'kl. ' + pad(nu.getHours()) + '.' + pad(nu.getMinutes()));
      saet('#kilde', res.kilde);
      live.classList.add('klar');
    }
    var sidsteFejl = '';
    function fejl() {
      var graf = $('#graf');
      if (graf && graf.hasAttribute('hidden')) { var sek = live.closest('section'); if (sek) sek.hidden = true; return; }
      if (graf) graf.innerHTML = '<p class="graf-fejl">Vi kan ikke hente dagens priser lige nu. Prøv at genindlæse siden om lidt – eller se priserne direkte hos <a href="https://www.energidataservice.dk/" rel="noopener">Energi Data Service</a>.<br><small style="opacity:.7">Teknisk: ' + sidsteFejl + '</small></p>';
    }
    function hent() {
      $$('.omraade:not(.dagvalg) button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.o === omr ? 'true' : 'false'); });
      var o = omr, kopi = laes(o);
      if (kopi) { try { vis(kopi); } catch (e) {} }
      hentEnerginet(o)
        .catch(function (e1) { sidsteFejl = 'Energinet: ' + (e1 && e1.message || e1); return vent(1500).then(function () { return hentEnerginet(o); }); })
        .catch(function (e2) { sidsteFejl = 'Energinet: ' + (e2 && e2.message || e2); return hentReserve(o); })
        .then(function (res) { gem(o, res); vis(res); })
        .catch(function (e3) { sidsteFejl += ' | Reserve: ' + (e3 && e3.message || e3); if (!kopi) fejl(); });
    }
    $$('.dagvalg button').forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; visDag = b.dataset.d; if (sidste) vis(sidste); }); });
    $$('.omraade:not(.dagvalg) button').forEach(function (b) { b.addEventListener('click', function () {
      omr = b.dataset.o; try { localStorage.setItem('omraade', omr); } catch (e) {} hent();
    }); });
    hent();
  }


  /* ---------- Apparat-tabeller: pris ved spotprisen lige nu ---------- */
  if ($('table.apparater')) document.addEventListener('elpris', function (ev) {
    var d = ev.detail, f2 = function (n) { return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr.'; };
    $$('table.apparater tbody tr').forEach(function (r) {
      var k = +r.dataset.kwh, a = $('.nu b', r), b = $('.lav', r);
      if (a) a.textContent = f2(k * d.nu / 100); if (b) b.textContent = f2(k * d.min / 100);
    });
  });

  /* ---------- Statistik, seneste 30 dage (hentes først, når sektionen er tæt på) ---------- */
  var st = $('#stat30');
  if (st) {
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; }, ds = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
    var hentet = null;
    var hentStat = function () {
      var o = 'DK1'; try { o = localStorage.getItem('omraade') || 'DK1'; } catch (e) {}
      if (hentet === o) return; hentet = o;
      var til = new Date(), fra = new Date(til.getTime() - 30 * 864e5);
      var url = 'https://api.energidataservice.dk/dataset/DayAheadPrices?start=' + ds(fra) + 'T00:00&end=' + ds(til) + 'T00:00&filter=' + encodeURIComponent(JSON.stringify({ PriceArea: [o] })) + '&limit=4000';
      fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var rk = (j.records || []).map(function (x) { return { t: new Date(x.TimeDK || x.HourDK), o: (x.DayAheadPriceDKK != null ? x.DayAheadPriceDKK : x.SpotPriceDKK) / 10 * 1.25 }; }).filter(function (x) { return !isNaN(x.t) && isFinite(x.o); });
        if (rk.length < 200) throw 0;
        var T = [], U = [], i; for (i = 0; i < 24; i++) T.push([0, 0]); for (i = 0; i < 7; i++) U.push([0, 0]);
        var sum = 0, timer = {};
        rk.forEach(function (x) { var h = x.t.getHours(), u = (x.t.getDay() + 6) % 7; T[h][0] += x.o; T[h][1]++; U[u][0] += x.o; U[u][1]++; sum += x.o; var k = ds(x.t) + h; (timer[k] = timer[k] || [0, 0]); timer[k][0] += x.o; timer[k][1]++; });
        var tS = T.map(function (a) { return a[1] ? a[0] / a[1] : 0; }), uS = U.map(function (a) { return a[1] ? a[0] / a[1] : 0; });
        var neg = Object.keys(timer).filter(function (k) { return timer[k][0] / timer[k][1] < 0; }).length;
        var mi = tS.indexOf(Math.min.apply(0, tS)), ma = tS.indexOf(Math.max.apply(0, tS));
        var saet2 = function (id, v) { var el = $(id); if (el) el.textContent = v; };
        saet2('#s-snit', ore(sum / rk.length)); saet2('#s-billig', 'kl. ' + p2(mi) + '–' + p2((mi + 1) % 24)); saet2('#s-dyr', 'kl. ' + p2(ma) + '–' + p2((ma + 1) % 24)); saet2('#s-neg', neg);
        var tegn = function (id, v, navne) { var top = Math.max.apply(0, v.concat([1])), lo = Math.min.apply(0, v), hi = Math.max.apply(0, v);
          $(id).innerHTML = v.map(function (x, i) { var kl = x <= lo + (hi - lo) * 0.33 ? ' lav' : (x >= lo + (hi - lo) * 0.72 ? ' hoj' : ''); return '<div class="s' + kl + '" tabindex="0" style="height:' + Math.max(4, x / top * 100).toFixed(1) + '%;animation-delay:' + i * 15 + 'ms" data-t="' + navne(i) + ': ' + ore(x) + ' øre"></div>'; }).join(''); };
        tegn('#s-timer', tS, function (i) { return 'kl. ' + p2(i); }); tegn('#s-uge', uS, function (i) { return ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'][i]; });
        var dage = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'], bu = uS.indexOf(Math.min.apply(0, uS));
        saet2('#s-tekst', 'De seneste 30 dage i ' + (o === 'DK1' ? 'Vestdanmark' : 'Østdanmark') + ': i gennemsnit var strømmen billigst kl. ' + p2(mi) + '–' + p2((mi + 1) % 24) + ' (' + ore(tS[mi]) + ' øre) og dyrest kl. ' + p2(ma) + '–' + p2((ma + 1) % 24) + ' (' + ore(tS[ma]) + ' øre). Billigste ugedag var ' + dage[bu] + '. Spotpris inkl. moms. Kilde: Energi Data Service (Energinet).');
      }).catch(function () { hentet = null; var g = $('#s-timer'); if (g) g.innerHTML = '<p class="graf-fejl">Statistikken kan ikke hentes lige nu.</p>'; });
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { hentStat(); } }, { rootMargin: '600px' }).observe(st); else hentStat();
    $$('.omraade:not(.dagvalg) button').forEach(function (b) { b.addEventListener('click', function () { setTimeout(hentStat, 50); }); });
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
