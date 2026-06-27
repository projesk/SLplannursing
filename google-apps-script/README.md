# Google Sheets tarpinis sluoksnis paciento vertinimams

Šis Apps Script kodas priima paciento vertinimo formos JSON duomenis ir įrašo juos į Google Sheets lapą `Vertinimai`.

## Diegimas

1. Sukurkite Google Sheet failą, kuriame bus laikomi vertinimai.
2. Google Sheets pasirinkite **Extensions → Apps Script**.
3. Į `Code.gs` įklijuokite `google-apps-script/Code.gs` turinį.
4. Jei Apps Script projektą sukūrėte ne per Google Sheets **Extensions → Apps Script**, į `CONFIG.SPREADSHEET_ID` įrašykite Google Sheet ID (ilga dalis tarp `/d/` ir `/edit` URL adrese).
5. Apps Script redaktoriuje vieną kartą paleiskite `setup()` ir suteikite leidimus.
6. Paleiskite `testWriteSample()` – lape `Vertinimai` turi atsirasti testinė eilutė. Jei ji neatsiranda, pirmiausia sutvarkykite `CONFIG.SPREADSHEET_ID` arba leidimus.
7. Pasirinkite **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone with the link arba jūsų organizacijos pasirinkimas
8. Nukopijuokite `/exec` Web app URL ir įrašykite jį į `GOOGLE_SCRIPT_URL` faile `js/generator.js`.
9. Po kiekvieno `Code.gs` pakeitimo sukurkite naują Web app deployment versiją arba redeploy'inkite esamą deployment, kad `/exec` naudotų naujausią kodą.

## Duomenų saugojimas

- Duomenys saugomi lape `Vertinimai`.
- Stulpelis `Įkelta` naudojamas automatiniam ištrynimui.
- `cleanupOldRows()` ištrina senesnius nei 7 dienų įrašus.
- `setup()` sukuria kasdienį trigerį, kuris automatiškai paleidžia valymą.

## Patikra

Atidarius Web app `/exec` URL naršyklėje, turi būti grąžinama JSON žinutė su `"ok":true`, `spreadsheet` ir `sheet`. Jei matote `"ok":false`, patikrinkite, ar scriptas atidarytas iš Google Sheets, arba užpildykite `CONFIG.SPREADSHEET_ID`. Paciento vertinimo forma siunčia duomenis per paslėptą POST formą į Apps Script Web App `/exec` adresą, nes Google Apps Script atsakymas naršyklėje dažnai nėra skaitomas per CORS. Į `GOOGLE_SCRIPT_URL` būtina įklijuoti būtent Apps Script Web App `/exec` URL, ne Google Sheets lentelės URL.
