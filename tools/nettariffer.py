# -*- coding: utf-8 -*-
"""
Henter nettariffer, Energinets tariffer, elafgift og 30 dages spotpris fra Energi Data Service (Energinet)
og skriver dem til data/nettariffer.json. Derefter bages tallene ind i HTML-siderne (mellem <!--NET:x--> og <!--/NET:x-->),
så Google ser rigtige tal uden JavaScript.

    python3 tools/nettariffer.py            # hent + byg (køres af GitHub Actions hver dag)
    python3 tools/nettariffer.py --kun-byg  # byg HTML ud fra den eksisterende data/nettariffer.json

Fejler hentningen, beholdes den gamle JSON-fil, og siderne bygges ud fra den. Kun Python-standardbiblioteket.
Alle priser i JSON-filen er UDEN moms (øre pr. kWh, kr. pr. måned). Moms lægges på ved visning.
"""
import csv, glob, io, json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROD = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TZ = ZoneInfo("Europe/Copenhagen")
MOMS = 1.25
API = "https://api.energidataservice.dk/dataset/"
MD = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"]

# Netselskaber: nøgle -> (visningsnavn, prisområde, ChargeOwner-navne i DataHub, tarifkoder, rabatkoder, abonnementskoder)
# Koderne er dem, selskaberne selv har indberettet til DataHub for almindelige husstande ("Nettarif C", timeafregnet).
NET = {
    "n1":        ("N1", "DK1", ["N1 A/S - 131", "N1 A/S - 344", "N1 A/S - 016"], ["CD", "T-C-F-F-TD", "C-Tarif"], [], ["CD", "A-C-F-04", "K_21000"]),
    "radius":    ("Radius Elnet", "DK2", ["Radius Elnet A/S"], ["DT_C_01"], [], ["DA_C_F_01"]),
    "cerius":    ("Cerius", "DK2", ["Cerius A/S"], ["30TR_C_ET"], ["30RE_C_ET"], ["30AB_CT"]),
    "konstant":  ("Konstant", "DK1", ["Konstant Net A/S - 151", "Konstant Net A/S - 245"], ["C_FBTNTR_B"], ["C_FBTNTR_R"], ["C_FBAHM__B"]),
    "trefor":    ("TREFOR El-net", "DK1", ["TREFOR El-net A/S"], ["C"], [], ["E-51"]),
    "trefor-oest": ("TREFOR El-net Øst", "DK2", ["TREFOR El-net Øst A/S"], ["46"], [], ["E-50"]),
    "vores-elnet": ("Vores Elnet", "DK1", ["Vores Elnet A/S"], ["TNT1009", "TNT1011"], [], ["AB1012", "AB1013"]),
    "dinel":     ("Dinel", "DK1", ["Dinel A/S"], ["TCL<100_02"], [], ["ACL<100_01"]),
    "nord-energi": ("Nord Energi Net", "DK1", ["Nord Energi Net A/S"], ["TAC"], [], ["ABC"]),
    "noe":       ("NOE Net", "DK1", ["NOE Net A/S"], ["30030"], [], ["32310"]),
    "rah":       ("RAH Net", "DK1", ["RAH Net A/S"], ["RAH-C"], [], ["ABON-COPG"]),
    "elvaerk":   ("Netselskabet Elværk", "DK1", ["Netselskabet Elværk A/S"], ["5NCFF"], [], ["5ACFF"]),
    "flow":      ("FLOW Elnet", "DK1", ["FLOW Elnet A/S"], ["FE1 NT-01"], [], ["FE1 E-50"]),
    "elinord":   ("Elinord", "DK1", ["Elinord A/S"], ["43300"], [], ["41300"]),
    "ravdex":    ("Ravdex", "DK1", ["Ravdex A/S"], ["NT-C"], [], ["E-50C1"]),
    "veksel":    ("Veksel", "DK1", ["Veksel A/S"], ["NT-01", "NT-10"], [], ["E-50"]),
    "elektrus":  ("Elektrus", "DK2", ["Elektrus A/S"], ["6000091"], [], ["6000082"]),
    "zeanet":    ("Zeanet", "DK2", ["Zeanet A/S"], ["43110"], [], ["41100"]),
    "l-net":     ("L-Net", "DK1", ["L-Net A/S"], ["3000"], [], ["4100"]),
    "elnet-midt": ("Elnet Midt", "DK1", ["Elnet Midt A/S"], ["T3001"], [], ["20001"]),
    "midtfyn":   ("Midtfyns Elforsyning", "DK1", ["Midtfyns Elforsyning  A.m.b.A", "Midtfyns Elforsyning A.m.b.A"], ["TNT15000", "TNT15001"], [], ["AB15000"]),
    "forsyning-elnet": ("Forsyning Elnet", "DK1", ["Forsyning Elnet A/S"], ["STR-NT-03"], [], ["STR-E-50"]),
    "ikast":     ("Ikast El Net", "DK1", ["Ikast El Net A/S"], ["IEV-NT-01"], [], ["IEV-E-50"]),
    "grindsted": ("Grindsted Elnet", "DK1", ["Grindsted Elnet A/S"], ["GEV-NT-01"], [], ["GEV-E-50"]),
    "tarm":      ("Tarm Elværk Net", "DK1", ["Tarm Elværk Net A/S"], ["TEV-NT-01T"], [], ["TEV-E-50"]),
    "hammel":    ("Hammel Elforsyning Net", "DK1", ["Hammel Elforsyning Net A/S"], ["C-Tarif"], [], ["55000"]),
    "hjerting":  ("Hjerting Transformatorforening", "DK1", ["Hjerting Transformatorforening"], ["C-Tarif"], [], ["HE-E-50"]),
    "sunds":     ("Sunds Net", "DK1", ["Sunds Net A.m.b.a"], ["SEF-NT-05"], ["SEF-NT-05R"], ["SEF-E-50"]),
    "aal":       ("Aal El-Net", "DK1", ["Aal El-Net A M B A"], ["AAL-NT-05"], [], ["AAL-E-50"]),
    "hurup":     ("Hurup Elværk Net", "DK1", ["Hurup Elværk Net A/S"], ["HEV-NT-01T"], [], ["HEV-E-50"]),
    "kimbrer":   ("Kimbrer Elnet", "DK1", ["Kimbrer Elnet A/S"], ["C-Tarif"], [], ["AARS-E-50"]),
    "laesoe":    ("Læsø Elnet", "DK1", ["Læsø Elnet A/S"], [], [], ["41100"]),
}
ENERGINET_GLN = "5790000432752"
STAT = {"transmission": "40000", "system": "41000", "elafgift": "EA-001"}

def dk(x, d=0):
    s = f"{x:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s
def kr(x): return dk(round(x)) + " kr."
def _hent_json(url, forsog=8):
    """Energi Data Service begrænser antal kald pr. IP (HTTP 429), og GitHubs servere deler IP. Vent og prøv igen."""
    import time, urllib.error
    sidste = None
    for i in range(forsog):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "skiftelaftale.dk"})
            with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as ex:
            sidste = ex
            if ex.code not in (429, 500, 502, 503, 504): raise
            vent = 20 + 15 * i
            try:
                m = re.search(r"(\d+)\s*second", ex.read().decode("utf-8", "ignore"))
                if m: vent = min(int(m.group(1)) + 3, 120)
            except Exception: pass
            print(f"  venter {vent} sek. (HTTP {ex.code}, forsøg {i + 1} af {forsog})"); time.sleep(vent)
        except Exception as ex:
            sidste = ex; time.sleep(10 + 10 * i)
    raise sidste
def hent(dataset, **q):
    return _hent_json(API + dataset + "?" + urllib.parse.urlencode(q))["records"]
def priser(rec):
    p1 = rec.get("Price1") or 0.0
    return [float(rec.get(f"Price{i}") if rec.get(f"Price{i}") is not None else p1) for i in range(1, 25)]
def gaeldende(recs, nu):
    return [r for r in recs if r["ValidFrom"] <= nu and (not r.get("ValidTo") or r["ValidTo"] > nu)]
def nyeste(recs): return max(recs, key=lambda r: r["ValidFrom"]) if recs else None

def hent_alt():
    nu = datetime.now(TZ); nu_s = nu.strftime("%Y-%m-%dT%H:%M:%S")
    start = (nu - timedelta(days=900)).strftime("%Y-%m-%dT00:00")
    d03 = gaeldende(hent("DatahubPricelist", start=start, limit=0, filter=json.dumps({"ChargeType": ["D03"]})), nu_s)
    d01 = gaeldende(hent("DatahubPricelist", start=start, limit=0, filter=json.dumps({"ChargeType": ["D01"]})), nu_s)
    ud = {"opdateret": nu.date().isoformat(), "kilde": "Energi Data Service (Energinet), datasæt DatahubPricelist og DayAheadPrices", "enhed": "øre pr. kWh og kr. pr. måned, uden moms", "moms": MOMS, "net": {}}
    stat = {}
    for navn, kode in STAT.items():
        r = nyeste([x for x in d03 if x.get("GLN_Number") == ENERGINET_GLN and x["ChargeTypeCode"] == kode])
        if r: stat[navn] = round(float(r["Price1"]) * 100, 3)
    if len(stat) != 3: raise RuntimeError("mangler Energinet-tariffer: %r" % stat)
    ud["stat"] = stat
    for key, (navn, omr, ejere, koder, rabat, abo) in NET.items():
        mine = [x for x in d03 if x.get("ChargeOwner") in ejere]
        t = None
        for k in koder:
            t = nyeste([x for x in mine if x["ChargeTypeCode"] == k])
            if t: break
        if not t:  # reserve: selskabets egen "Nettarif C" på timebasis
            t = nyeste([x for x in mine if re.match(r"^\s*Nettarif C( time)?\s*$", x.get("Note") or "", flags=re.I)])
        if not t: continue
        p = priser(t)
        for k in rabat:
            rr = nyeste([x for x in mine if x["ChargeTypeCode"] == k and x.get("ChargeOwner") == t.get("ChargeOwner")])
            if rr: p = [a + b for a, b in zip(p, priser(rr))]
        p = [round(max(v, 0) * 100, 3) for v in p]
        a = None
        mine_abo = [x for x in d01 if x.get("ChargeOwner") in ejere]
        for k in abo:
            a = nyeste([x for x in mine_abo if x["ChargeTypeCode"] == k])
            if a: break
        if not a: a = nyeste([x for x in mine_abo if re.match(r"^\s*Net abo C forbrug( time)?\s*$", x.get("Note") or "", flags=re.I)])
        ud["net"][key] = {"navn": navn, "omraade": omr, "tarif": p, "lav": min(p), "hoj": sorted(set(p))[len(set(p)) // 2] if len(set(p)) > 1 else p[0], "spids": max(p),
                          "snit": round(sum(p) / 24, 3), "abo": round(float(a["Price1"]), 2) if a else None, "kode": t["ChargeTypeCode"], "gyldig_fra": t["ValidFrom"][:10]}
    if len(ud["net"]) < 20: raise RuntimeError("for få netselskaber fundet: %d" % len(ud["net"]))
    # spotpris: gennemsnit seneste 30 dage pr. prisområde
    slut = nu.date(); fra = slut - timedelta(days=30)
    sp = hent("DayAheadPrices", start=fra.isoformat() + "T00:00", end=slut.isoformat() + "T00:00", limit=0, columns="PriceArea,DayAheadPriceDKK", filter=json.dumps({"PriceArea": ["DK1", "DK2"]}))
    s = {}
    for x in sp:
        if x.get("DayAheadPriceDKK") is None: continue
        a = s.setdefault(x["PriceArea"], [0.0, 0]); a[0] += x["DayAheadPriceDKK"]; a[1] += 1
    ud["spot30"] = {o: round(v[0] / v[1] / 10, 2) for o, v in s.items()}
    ud["spot30"].update(fra=fra.isoformat(), til=slut.isoformat())
    if "DK1" not in ud["spot30"] or "DK2" not in ud["spot30"]: raise RuntimeError("mangler spotpriser")
    return ud

# ---------------- beregning ----------------
def selskaber():
    return json.load(open(os.path.join(ROD, "data", "elselskaber.json"), encoding="utf-8"))["selskaber"]
def selskab_pris(s, kwh):
    """Billigste aftale: (kr. pr. år til elselskabet inkl. moms, aftalens navn)"""
    bedst = None
    for a in s["aftaler"]:
        abo = a["abo_kr_md"]
        for mx, v in (a.get("trin") or []):
            if mx is None or kwh <= mx: abo = v; break
        p = a["tillaeg_oere"] * kwh / 100 + 12 * abo + (a.get("gebyr_kr_aar") or 0) + (a.get("gebyr_oere_kwh") or 0) * kwh / 100
        if bedst is None or p < bedst[0]: bedst = (p, a["navn"])
    return bedst
def faelles(d, net, kwh):
    """Den del af regningen, der er ens hos alle elselskaber (kr. pr. år inkl. moms) + delene i øre/kWh inkl. moms"""
    n = d["net"][net]; st = d["stat"]; spot = d["spot30"][n["omraade"]]
    dele = {"spot": spot * MOMS, "net": n["snit"] * MOMS, "energinet": (st["system"] + st["transmission"]) * MOMS, "afgift": st["elafgift"] * MOMS}
    abo = (n["abo"] or 0) * MOMS
    return sum(dele.values()) * kwh / 100 + 12 * abo, dele, abo
def net_aar(n, kwh=4000): return n["snit"] * MOMS * kwh / 100 + 12 * (n["abo"] or 0) * MOMS

# ---------------- HTML-blokke ----------------
def saet(h, navn, indhold):
    return re.sub(r"(<!--NET:" + re.escape(navn) + r"-->).*?(<!--/NET:" + re.escape(navn) + r"-->)", lambda m: m.group(1) + indhold + m.group(2), h, flags=re.S)
def dato_txt(iso):
    y, m, dd = iso.split("-"); return f"{int(dd)}. {MD[int(m) - 1]} {y}"
def rod_for(sti): return "../" * sti.count("/")

def blok_dele(d, net, kwh=4000):
    n = d["net"][net]; _, dele, abo = faelles(d, net, kwh)
    S = selskaber(); liste = sorted(((selskab_pris(s, kwh)[0], s) for s in S), key=lambda x: x[0])
    bil = liste[0]; sel_ore = bil[0] / kwh * 100
    ialt = sum(dele.values()) + abo * 12 / kwh * 100 + sel_ore
    rk = [("Spotpris (børsprisen)", dele["spot"], f"Gennemsnit de seneste 30 dage i {'Vestdanmark' if n['omraade'] == 'DK1' else 'Østdanmark'}. Ens hos alle elselskaber."),
          (f"Nettarif til {n['navn']}", dele["net"], "Betaling for at få strømmen frem til dig. Gennemsnit over døgnet."),
          (f"Abonnement til {n['navn']}", abo * 12 / kwh * 100, f"{dk(abo, 2)} kr. om måneden, fordelt på {dk(kwh)} kWh."),
          ("Energinets tariffer", dele["energinet"], "System- og transmissionstarif til det overordnede elnet."),
          ("Elafgift til staten", dele["afgift"], "Afgiften er sat ned til EU's minimum i 2026 og 2027."),
          (f"Elselskabet (billigste: {bil[1]['navn']})", sel_ore, "Tillæg, abonnement og gebyrer. Den eneste del, du selv kan ændre.")]
    tr = "".join(f'<tr><th scope="row">{a}</th><td class="tal"><b>{dk(b, 1)} øre</b></td><td class="tal">{dk(b / ialt * 100)} %</td><td>{c}</td></tr>' for a, b, c in rk)
    return (f'<div class="tabel-rul"><table class="stak"><caption>Sådan er en kWh sat sammen hos {n["navn"]} ved {dk(kwh)} kWh om året ({dato_txt(d["opdateret"])})</caption>'
            f'<thead><tr><th>Del af prisen</th><th class="tal">Øre pr. kWh</th><th class="tal">Andel</th><th>Forklaring</th></tr></thead><tbody>{tr}'
            f'<tr class="sum"><th scope="row">I alt</th><td class="tal"><b>{dk(ialt, 1)} øre</b></td><td class="tal">100 %</td><td>Svarer til {kr(ialt * kwh / 100 / 12)} om måneden.</td></tr></tbody></table></div>')

def blok_top(d, net, rod, kwh=4000, antal=10):
    n = d["net"][net]; f, _, _ = faelles(d, net, kwh)
    S = selskaber(); liste = sorted(((selskab_pris(s, kwh), s) for s in S), key=lambda x: x[0][0])[:antal]
    tr = "".join(f'<tr><th scope="row">{i + 1}. <a href="{rod}elselskaber/{s["slug"]}/">{s["navn"]}</a><small class="gebyr">{p[1]}</small></th>'
                 f'<td class="tal"><b>{dk((f + p[0]) / kwh, 2)} kr.</b></td><td class="tal">{kr((f + p[0]) / 12)}</td><td class="tal">{kr(p[0] / 12)}</td></tr>' for i, (p, s) in enumerate(liste))
    return (f'<div class="tabel-rul"><table class="stak"><caption>Hele elregningen hos {n["navn"]} ved {dk(kwh)} kWh om året ({dato_txt(d["opdateret"])}), sorteret efter pris</caption>'
            f'<thead><tr><th>Elselskab og aftale</th><th class="tal">Pris pr. kWh i alt</th><th class="tal">Pr. måned i alt</th><th class="tal">Heraf til elselskabet</th></tr></thead><tbody>{tr}</tbody></table></div>')

def net_md(n, kwh=4000): return net_aar(n, kwh) / 12
def blok_net_tabel(d, rod):
    rk = sorted(d["net"].items(), key=lambda kv: net_aar(kv[1]))
    try: omr = json.load(open(os.path.join(ROD, "data", "netomraader.json"), encoding="utf-8"))
    except Exception: omr = {}
    tr = ""
    for i, (k, n) in enumerate(rk):
        flad = n["lav"] == n["spids"]
        tr += (f'<tr id="{k}"><th scope="row">{i + 1}. {n["navn"]}<small class="gebyr">{omr.get(k) or ("Vestdanmark" if n["omraade"] == "DK1" else "Østdanmark")}</small></th>'
               f'<td class="tal">{dk(n["lav"] * MOMS, 1)}</td><td class="tal">{dk(n["hoj"] * MOMS, 1) if not flad else "–"}</td><td class="tal">{dk(n["spids"] * MOMS, 1) if not flad else "–"}</td>'
               f'<td class="tal">{dk(n["snit"] * MOMS, 1)}</td><td class="tal">{(dk(n["abo"] * MOMS, 2) + " kr.") if n["abo"] is not None else "Ikke oplyst"}</td><td class="tal"><b>{kr(net_md(n))}</b></td></tr>')
    return (f'<div class="tabel-rul"><table class="stak"><caption>Nettarif og netabonnement hos {len(rk)} netselskaber, inkl. moms ({dato_txt(d["opdateret"])}). Billigste først.</caption>'
            f'<thead><tr><th>Netselskab</th><th class="tal">Lavlast (øre/kWh)</th><th class="tal">Højlast</th><th class="tal">Spidslast</th><th class="tal">Gennemsnit over døgnet</th><th class="tal">Abonnement pr. md.</th><th class="tal">I alt pr. md. ved 4.000 kWh/år</th></tr></thead><tbody>{tr}</tbody></table></div>')

def noegletal(d):
    rk = sorted((n for n in d["net"].values() if n["abo"] is not None and n["snit"] > 0), key=net_aar)
    store = sorted((n for k, n in d["net"].items() if k in ("n1", "radius", "cerius", "konstant", "trefor", "vores-elnet")), key=net_aar)
    return {"antal": len(d["net"]), "billigst": rk[0], "dyrest": rk[-1], "forskel": net_md(rk[-1]) - net_md(rk[0]), "store": store, "median": net_md(rk[len(rk) // 2])}

def blok_noegle(d):
    k = noegletal(d)
    return (f'En husstand med et forbrug på 4.000 kWh om året betaler lige nu {kr(net_md(k["billigst"]))} om måneden for transporten af strømmen hos {k["billigst"]["navn"]}, '
            f'men {kr(net_md(k["dyrest"]))} hos {k["dyrest"]["navn"]}. Det er en forskel på {kr(k["forskel"])} om måneden for præcis samme ydelse. '
            f'Blandt de seks største netselskaber er {k["store"][0]["navn"]} billigst med {kr(net_md(k["store"][0]))} om måneden og {k["store"][-1]["navn"]} dyrest med {kr(net_md(k["store"][-1]))[:-1]}.')

def blok_billigste(d, rod):
    ud = []
    for net in ("n1", "radius"):
        if net not in d["net"]: continue
        f, _, _ = faelles(d, net, 4000); S = selskaber()
        p, s = min(((selskab_pris(x, 4000), x) for x in S), key=lambda x: x[0][0])
        ud.append(f'<li><b>{"Vestdanmark" if net == "n1" else "Østdanmark"} ({d["net"][net]["navn"]}):</b> {dk((f + p[0]) / 4000, 2)} kr. pr. kWh i alt hos {s["navn"]}, svarende til {kr((f + p[0]) / 12)} om måneden. Heraf går {kr(p[0] / 12)} til elselskabet.</li>')
    return (f'<p>Tallene på denne side er den del, du betaler til elselskabet. Lægger vi spotpris, nettarif, Energinets tariffer, elafgift og moms oveni, ser hele regningen sådan ud ved 4.000 kWh om året ({dato_txt(d["opdateret"])}):</p>'
            f'<ul>{"".join(ud)}</ul><p><a href="{rod}kwh-pris/#hele-regningen">Beregn hele elregningen med dit postnummer</a>, eller se <a href="{rod}nettarif/">nettariffen hos alle netselskaber</a>.</p>')

def skriv_csv(d):
    b = io.StringIO(); w = csv.writer(b)
    w.writerow(["netselskab", "prisomraade", "lavlast_oere_kwh_inkl_moms", "hoejlast_oere_kwh_inkl_moms", "spidslast_oere_kwh_inkl_moms", "gennemsnit_oere_kwh_inkl_moms", "abonnement_kr_md_inkl_moms", "netbetaling_kr_md_ved_4000_kwh_aar", "gyldig_fra", "hentet"])
    for k, n in sorted(d["net"].items(), key=lambda kv: net_aar(kv[1])):
        w.writerow([n["navn"], n["omraade"], round(n["lav"] * MOMS, 2), round(n["hoj"] * MOMS, 2), round(n["spids"] * MOMS, 2), round(n["snit"] * MOMS, 2), round(n["abo"] * MOMS, 2) if n["abo"] is not None else "", round(net_md(n)), n["gyldig_fra"], d["opdateret"]])
    os.makedirs(os.path.join(ROD, "nettarif"), exist_ok=True)
    open(os.path.join(ROD, "nettarif", "nettariffer.csv"), "w", encoding="utf-8", newline="").write(b.getvalue())

def byg(d):
    n = 0
    for fil in glob.glob(os.path.join(ROD, "**", "*.html"), recursive=True):
        h = open(fil, encoding="utf-8").read()
        if "<!--NET:" not in h: continue
        sti = os.path.relpath(fil, ROD).replace(os.sep, "/"); rod = rod_for(sti); o = h
        for net in d["net"]:
            if f"<!--NET:dele-{net}-->" in h: h = saet(h, f"dele-{net}", blok_dele(d, net))
            if f"<!--NET:top-{net}-->" in h: h = saet(h, f"top-{net}", blok_top(d, net, rod))
        h = saet(h, "tabel", blok_net_tabel(d, rod))
        h = saet(h, "noegle", blok_noegle(d))
        h = saet(h, "billigste", blok_billigste(d, rod))
        h = saet(h, "dato", dato_txt(d["opdateret"]))
        h = saet(h, "antal", str(len(d["net"])))
        h = saet(h, "spot-dk1", dk(d["spot30"]["DK1"] * MOMS, 1)); h = saet(h, "spot-dk2", dk(d["spot30"]["DK2"] * MOMS, 1))
        h = saet(h, "stat", dk((d["stat"]["system"] + d["stat"]["transmission"]) * MOMS, 1)); h = saet(h, "afgift", dk(d["stat"]["elafgift"] * MOMS, 1))
        if h != o: open(fil, "w", encoding="utf-8").write(h); n += 1
    skriv_csv(d)
    return n

def main():
    sti = os.path.join(ROD, "data", "nettariffer.json")
    gammel = json.load(open(sti, encoding="utf-8")) if os.path.exists(sti) else None
    d = gammel
    if "--kun-byg" not in sys.argv:
        try:
            d = hent_alt()
            if gammel:  # behold netselskaber, der midlertidigt mangler i svaret
                for k, v in gammel["net"].items(): d["net"].setdefault(k, v)
            json.dump(d, open(sti, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            # sitemap: siderne med nettariffer har nye tal
            sf = os.path.join(ROD, "sitemap.xml")
            if gammel and os.path.exists(sf) and json.dumps(gammel.get("net"), sort_keys=True) != json.dumps(d["net"], sort_keys=True):
                s = open(sf, encoding="utf-8").read()
                s = re.sub(r"(<loc>https://skiftelaftale\.dk/nettarif/</loc>\s*<lastmod>)[^<]*", lambda m: m.group(1) + d["opdateret"], s)
                open(sf, "w", encoding="utf-8").write(s)
        except Exception as ex:
            print("::warning title=Nettariffer ikke hentet::bruger de gemte tal:", ex)
            d = gammel
    if not d: print("nettariffer: ingen data, springer over"); return 0
    print("nettariffer:", len(d["net"]), "netselskaber,", byg(d), "sider opdateret, data fra", d["opdateret"])
    return 0

if __name__ == "__main__": sys.exit(main())
