# -*- coding: utf-8 -*-
"""Fortæller Bing (og dermed bl.a. ChatGPT-søgning, Yandex, Seznam) at siderne er opdateret – via IndexNow.
Køres af GitHub Actions efter upload. Sender kun de sider, der er ændret i dag ifølge sitemap.xml (lastmod),
og altid elpris-siderne, som får nye tal hver dag. Fejl stopper ikke udgivelsen."""
import json, os, re, sys, urllib.request
from datetime import date
ROD = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
KEY = "ff9de89458faf810cb1b0ac9d7b8faf8"
HOST = "skiftelaftale.dk"
def main():
    sm = open(os.path.join(ROD, "sitemap.xml"), encoding="utf-8").read()
    par = re.findall(r"<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>", sm)
    i_dag = date.today().isoformat()
    urls = [u for u, d in par if d == i_dag]
    for u in ("https://%s/" % HOST, "https://%s/elpriser/" % HOST, "https://%s/elpriser/i-morgen/" % HOST, "https://%s/kwh-pris/" % HOST):
        if u not in urls: urls.append(u)
    if "--alle" in sys.argv: urls = [u for u, _ in par]
    data = json.dumps({"host": HOST, "key": KEY, "keyLocation": "https://%s/%s.txt" % (HOST, KEY), "urlList": urls}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=data, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: print("indexnow:", r.status, len(urls), "adresser sendt")
    except Exception as ex:
        print("::warning title=IndexNow::kunne ikke sende:", ex)
    return 0
if __name__ == "__main__": sys.exit(main())
