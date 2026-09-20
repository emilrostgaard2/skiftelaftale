# SkiftElaftale.dk – statisk site

Upload INDHOLDET af denne mappe til roden af dit GitHub-repo (index.html skal ligge i roden).
README.md bliver ikke deployet (den er udelukket i deploy.yml).

## Ret før du går live
1. **Forfatter og e-mail**: søg og erstat "Emil Rostgaard" og "kontakt@skiftelaftale.dk" hvis de ikke passer.
2. **Affiliatelinks**: hver fil i /go/<selskab>/index.html sender lige nu til selskabets forside.
   Udskift de tre steder URL'en står (meta refresh, MAAL og fallback-linket) med dit affiliatelink.
3. **Faktatjek priser**: alle tal er inkl. moms og samlet 20. september 2026 fra offentlige kilder
   (elpris.dk-data via sammenligningssider, selskabernes sider, Trustpilot, EPSI). Kontrollér hvert selskab
   mod deres egen hjemmeside, før du lancerer – især Jysk Energi (kampagnepris), OK (binding) og ejerforhold.
4. **404-side**: tilføj `ErrorDocument 404 /404.html` i .htaccess hos Simply.
5. **Google Search Console**: indsend https://skiftelaftale.dk/sitemap.xml

## Hver måned
Titlerne indeholder måneden (fx "september 2026"). Ret MAANED, TJEKKET og TJEKKET_ISO øverst i src/kerne.py og byg igen,
eller bed om en ny zip.

## Opdatering af priser
Priser og tekster ligger i kildekoden (separat zip: src/kerne.py). Ret tallene, kør `python3 src/build.py`,
og upload den nye out-mappe. Alle tabeller, scorer, beregner og schema genberegnes automatisk.
