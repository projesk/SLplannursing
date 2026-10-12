# Google Sheets tarpinis sluoksnis paciento vertinimams

Šis Apps Script kodas priima paciento vertinimo formos JSON duomenis ir įrašo juos į Google Sheets lapą `Vertinimai`.

## Diegimas

1. Sukurkite Google Sheet failą, kuriame bus laikomi vertinimai.
2. Google Sheets pasirinkite **Extensions → Apps Script**.
3. Į `Code.gs` įklijuokite `google-apps-script/Code.gs` turinį.
4. Jei Apps Script projektą sukūrėte ne per Google Sheets **Extensions → Apps Script**, į `CONFIG.SPREADSHEET_ID` įrašykite Google Sheet ID (ilga dalis tarp `/d/` ir `/edit` URL adrese).
5. Apps Script redaktoriuje vieną kartą paleiskite `setup()` ir suteikite leidimus. Po šio atnaujinimo `setup()` reikia paleisti dar kartą, kad būtų sukurtas archyvo lapas ir pakeistas valymo trigeris.
6. Paleiskite `testWriteSample()` – lape `Vertinimai` turi atsirasti testinė eilutė. Jei ji neatsiranda, pirmiausia sutvarkykite `CONFIG.SPREADSHEET_ID` arba leidimus.
7. Pasirinkite **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone with the link arba jūsų organizacijos pasirinkimas
8. Nukopijuokite `/exec` Web app URL ir įrašykite jį į `GOOGLE_SCRIPT_URL` faile `js/generator.js`.
9. Po kiekvieno `Code.gs` pakeitimo sukurkite naują Web app deployment versiją arba redeploy'inkite esamą deployment, kad `/exec` naudotų naujausią kodą.

## Duomenų saugojimas

- Aktyvaus paciento duomenys saugomi lape `Vertinimai` ir pagal amžių automatiškai netrinami.
- Paspaudus slaugytojos puslapio mygtuką „Naujas pacientas“, visi tos palatos ir lovos aktyvūs vertinimai perkeliami į lapą `Neaktyvios istorijos` kaip viena užbaigta istorija.
- Slaugytojos puslapio `list` užklausa skaito tik lapą `Vertinimai`, todėl archyvuotos istorijos slaugytojos lange neberodomos.
- `cleanupArchivedHistories()` kiekvienai palatai ir lovai palieka dvi naujausias neaktyvias istorijas, o senesnes ištrina.
- `setup()` sukuria savaitinį pirmadienio trigerį, kuris apie 3 val. automatiškai paleidžia archyvo valymą.

## Patikra

Atidarius Web app `/exec` URL naršyklėje, turi būti grąžinama JSON žinutė su `"ok":true`, `spreadsheet` ir `sheet`. Jei matote `"ok":false`, patikrinkite, ar scriptas atidarytas iš Google Sheets, arba užpildykite `CONFIG.SPREADSHEET_ID`. Paciento vertinimo forma siunčia duomenis per `sendBeacon` / `no-cors` POST į Apps Script Web App `/exec` adresą, nes Google Apps Script atsakymas naršyklėje dažnai nėra skaitomas per CORS. Į `GOOGLE_SCRIPT_URL` būtina įklijuoti būtent Apps Script Web App `/exec` URL, ne Google Sheets lentelės URL.

## Slaugytojos puslapis

`nurse.html` duomenis skaito per tą patį Apps Script `/exec` adresą su `?action=list&callback=...` JSONP užklausa. Mygtukas „Naujas pacientas“ kviečia `?action=clearBed&palata=...&lova=...`; dėl suderinamumo URL veiksmo pavadinimas liko `clearBed`, tačiau duomenys ne ištrinami, o perkeliami į `Neaktyvios istorijos` lapą. Slaugytojos puslapis automatiškai perskaito `/exec` adresą iš `js/generator.js` esančio `GOOGLE_SCRIPT_URL`, todėl pakeitus paciento formos URL atskirai `js/nurse.js` keisti nereikia.
