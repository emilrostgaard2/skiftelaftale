# -*- coding: utf-8 -*-
"""
Skriver et statisk øjebliksbillede af spotprisen ind i HTML-filerne, så Google og AI-søgemaskiner
ser rigtige tal i stedet for "–". Køres af GitHub Actions lige før FTP-upload (fx dagligt kl. 13.30).

    python3 tools/snapshot.py            # henter fra Energi Data Service (Energinet)
    python3 tools/snapshot.py --mock f.json   # test med gemt svar

Fejler hentningen, afslutter scriptet uden at ændre noget (siden virker stadig, JS henter live i browseren).
Kun Python-standardbiblioteket bruges.
"""
import json, os, re, sys, glob, urllib.request, urllib.parse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROD = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TZ = ZoneInfo("Europe/Copenhagen")
OMR = "DK1"

def ore(x): return f"{x:.1f}".replace(".", ",")
def kr2(x): return f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " kr."
def pad(n): return f"{n:02d}"

def hent(start, slut):
    q = urllib.parse.urlencode({"start": start + "T00:00", "end": slut + "T00:00", "filter": json.dumps({"PriceArea": [OMR]}), "sort": "TimeDK asc", "limit": 5000})
    req = urllib.request.Request("https://api.energidataservice.dk/dataset/DayAheadPrices?" + q, headers={"User-Agent": "skiftelaftale.dk snapshot"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)

def timer(records):
    """Kvarterspriser -> timegennemsnit i øre/kWh inkl. moms. Nøgle: (dato, time)."""
    m = {}
    for x in records:
        t = x.get("TimeDK") or x.get("HourDK"); p = x.get("DayAheadPriceDKK", x.get("SpotPriceDKK"))
        if t is None or p is None: continue
        d = datetime.fromisoformat(t)
        k = (d.date().isoformat(), d.hour); a = m.setdefault(k, [0.0, 0]); a[0] += p; a[1] += 1
    return {k: v[0] / v[1] / 10 * 1.25 for k, v in sorted(m.items())}

def saet(h, ident, inner, attr="id"):
    return re.sub(r'(<(\w+)[^>]*\b' + attr + r'="' + re.escape(ident) + r'"[^>]*>)(.*?)(</\2>)', lambda m: m.group(1) + inner + m.group(4), h, count=1, flags=re.S)

def niveau(v, lo, hi):
    return "lav" if v <= lo + (hi - lo) * .33 else ("hoj" if v >= lo + (hi - lo) * .72 else "")

def main():
    nu = datetime.now(TZ)
    idag = nu.date(); imorgen = idag + timedelta(days=1)
    try:
        if "--mock" in sys.argv:
            j = json.load(open(sys.argv[sys.argv.index("--mock") + 1])); j30 = j
        else:
            j = hent(idag.isoformat(), (idag + timedelta(days=2)).isoformat())
            j30 = hent((idag - timedelta(days=30)).isoformat(), idag.isoformat())
        T = timer(j.get("records", [])); T30 = timer(j30.get("records", []))
    except Exception as ex:
        print("snapshot: kunne ikke hente priser, springer over:", ex); return 0
    dage = {"idag": [(h, v) for (d, h), v in T.items() if d == idag.isoformat()],
            "imorgen": [(h, v) for (d, h), v in T.items() if d == imorgen.isoformat()]}
    if len(dage["idag"]) < 20:
        print("snapshot: for få timer for i dag, springer over"); return 0
    har_im = len(dage["imorgen"]) >= 20
    stempel = f"{idag.day}.{idag.month}.{idag.year} kl. {pad(nu.hour)}.{pad(nu.minute)}"
    filer = [f for f in glob.glob(os.path.join(ROD, "**", "*.html"), recursive=True) if "/tools/" not in f]
    n = 0
    for fil in filer:
        h = open(fil, encoding="utf-8").read()
        if "data-snap" not in h and "llms" not in fil: continue
        start = "imorgen" if ('data-start="imorgen"' in h and har_im) else "idag"
        dag = dage[start]; v = [x for _, x in dag]
        lo, hi, snit = min(v), max(v), sum(v) / len(v)
        nu_v = dict(dag).get(nu.hour, v[0]) if start == "idag" else snit
        tmin = dag[v.index(lo)][0]; tmax = dag[v.index(hi)][0]
        dagnavn = "i dag" if start == "idag" else "i morgen"
        for k, val in {"pris-nu": ore(nu_v), "pris-snit": ore(snit), "pris-min": ore(lo), "pris-max": ore(hi),
                       "tid-min": f"kl. {pad(tmin)}–{pad((tmin + 1) % 24)}", "tid-max": f"kl. {pad(tmax)}–{pad((tmax + 1) % 24)}", "hentet": stempel}.items():
            h = saet(h, k, val)
        if har_im:
            im_v = [x for _, x in dage["imorgen"]]
            h = saet(h, "imorgen", f"I morgen ligger gennemsnittet på {ore(sum(im_v) / len(im_v))} øre/kWh inkl. moms.")
        else:
            h = saet(h, "imorgen", "Morgendagens priser offentliggøres normalt omkring kl. 13.")
        h = saet(h, "snap-tekst", f"Tallene er et øjebliksbillede for Vestdanmark (DK1) {dagnavn} fra {stempel} og opdateres live, når siden åbnes.", attr="data-snap")
        # graf (kun hvis den er synlig)
        if re.search(r'<div id="graf" class="graf"', h):
            bars = "".join(f'<div class="s {niveau(x, lo, hi)}" style="height:{max(3, (x - min(lo, 0)) / ((max(hi, 1) - min(lo, 0)) or 1) * 100):.1f}%" data-t="kl. {pad(t)}: {ore(x)} øre"></div>' for t, x in dag)
            h = saet(h, "graf", bars)
        # tabel time for time
        if 'id="timetabel"' in h:
            rk = []
            for t, x in dag:
                d = x - snit; nv = niveau(x, lo, hi); m = {"lav": ("gron", "Billig"), "hoj": ("rod", "Dyr"), "": ("", "Middel")}[nv]
                rk.append(f'<tr><th scope="row" data-label="Time">kl. {pad(t)}–{pad((t + 1) % 24)}</th><td class="tal" data-label="Spotpris inkl. moms"><b>{ore(x)} øre</b></td><td class="tal" data-label="Mod døgnets snit">{"+" if d >= 0 else "−"}{ore(abs(d))} øre</td><td data-label="Niveau"><span class="maerke {m[0]}">{m[1]}</span></td></tr>')
            h = saet(h, "timetabel", "".join(rk))
            h = saet(h, "tt-cap", f"Spotpris time for time {dagnavn}, Vestdanmark (DK1)")
        # billigste sammenhængende timer
        if 'id="vinduer"' in h:
            li = []
            for n_, navn in [(2, "Vask eller opvask (2 timer)"), (4, "Tørretumbler + vask (4 timer)"), (6, "Opladning af elbil (6 timer)")]:
                b = min(((sum(v[i:i + n_]), i) for i in range(len(v) - n_ + 1)), default=None)
                if b: li.append(f'<li><span>{navn}</span><b class="tal">kl. {pad(dag[b[1]][0])}–{pad((dag[b[1] + n_ - 1][0] + 1) % 24)}</b><small>snit {ore(b[0] / n_)} øre/kWh</small></li>')
            h = saet(h, "vinduer", "".join(li))
        if 'id="eksempler"' in h:
            h = saet(h, "eksempler", "".join(f'<li><span>{t}</span><b class="tal">{kr2(k * snit / 100)}</b><small>billigst {dagnavn}: {kr2(k * lo / 100)}</small></li>' for t, k in [("En vask (0,8 kWh)", .8), ("En opvask (1 kWh)", 1), ("En tur i tørretumbleren (2 kWh)", 2), ("Opladning af elbil (40 kWh)", 40)]))
        # apparater
        if "apparater" in h:
            def rad(m):
                k = float(m.group(1)); r = m.group(0)
                r = re.sub(r'(class="tal nu"><b>)(.*?)(</b>)', lambda x: x.group(1) + kr2(k * snit / 100) + x.group(3), r, count=1)
                return re.sub(r'(class="tal lav">)(.*?)(</td>)', lambda x: x.group(1) + kr2(k * lo / 100) + x.group(3), r, count=1)
            h = re.sub(r'<tr data-kwh="([\d.]+)">.*?</tr>', rad, h, flags=re.S)
        # 30 dage
        if 'id="stat30"' in h and len(T30) > 200:
            tS = {t: [] for t in range(24)}
            for (d, t), x in T30.items(): tS[t].append(x)
            tS = {t: sum(a) / len(a) for t, a in tS.items() if a}
            alle = list(T30.values()); bi = min(tS, key=tS.get); dy = max(tS, key=tS.get)
            h = saet(h, "s-snit", ore(sum(alle) / len(alle))); h = saet(h, "s-neg", str(sum(1 for x in alle if x < 0)))
            h = saet(h, "s-billig", f"kl. {pad(bi)}–{pad((bi + 1) % 24)}"); h = saet(h, "s-dyr", f"kl. {pad(dy)}–{pad((dy + 1) % 24)}")
        open(fil, "w", encoding="utf-8").write(h); n += 1
    # llms.txt
    lf = os.path.join(ROD, "llms.txt")
    if os.path.exists(lf):
        v = [x for _, x in dage["idag"]]
        t = open(lf, encoding="utf-8").read()
        t = re.sub(r"<!--SNAPSHOT-->.*?<!--/SNAPSHOT-->", f"<!--SNAPSHOT-->Spotpris Vestdanmark (DK1) {idag.isoformat()}: gennemsnit {ore(sum(v) / len(v))} øre/kWh inkl. moms, laveste {ore(min(v))} øre, højeste {ore(max(v))} øre. Kilde: Energi Data Service (Energinet).<!--/SNAPSHOT-->", t, flags=re.S)
        open(lf, "w", encoding="utf-8").write(t)
    print(f"snapshot: {n} filer opdateret ({stempel})")
    return 0

if __name__ == "__main__": sys.exit(main())
