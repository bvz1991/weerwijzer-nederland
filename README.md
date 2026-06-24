# WeerWijzer Nederland – installeerbare app

Deze versie is een Progressive Web App (PWA). Eén en dezelfde app werkt:

- online op Windows, macOS en Linux;
- geïnstalleerd op Android;
- geïnstalleerd op iPhone en iPad;
- als normale website in iedere moderne browser.

## Gratis online publiceren

Het pakket is voorbereid voor Vercel, omdat de kleine alarmfeed daar eveneens
gratis kan draaien.

1. Zet de map in een GitHub-repository.
2. Maak een gratis account op https://vercel.com.
3. Importeer de repository.
4. Kies `weerwijzer-app` als Root Directory.
5. Laat Build Command en Output Directory leeg en publiceer.

Daarna ontvang je een HTTPS-adres. HTTPS is vereist voor GPS en installatie.

## Installeren

### iPhone of iPad

Open het HTTPS-adres in Safari, tik op Delen en kies `Zet op beginscherm`.

### Android

Open het adres in Chrome en tik op `Installeer app` of kies
`Toevoegen aan startscherm` in het browsermenu.

### Computer

Open het adres in Chrome of Edge en klik op het installatiepictogram in de
adresbalk. De app krijgt een eigen venster en pictogram.

## Lokaal testen

Start `server.py` met Python en open http://127.0.0.1:4173.

De weer- en luchtgegevens komen van Open-Meteo. Waarschuwingen komen via de
officiële Meteoalarm-feed. De app verwijst daarnaast rechtstreeks naar KNMI.
