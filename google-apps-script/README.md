# Google Sheets tarpinis sluoksnis paciento vertinimams

Šis Apps Script kodas priima paciento vertinimo formos JSON duomenis ir įrašo juos į Google Sheets lapą `Vertinimai`.

## Diegimas

1. Sukurkite Google Sheet failą, kuriame bus laikomi vertinimai.
2. Google Sheets pasirinkite **Extensions → Apps Script**.
3. Į `Code.gs` įklijuokite `google-apps-script/Code.gs` turinį.
4. Apps Script redaktoriuje vieną kartą paleiskite `setup()` ir suteikite leidimus.
5. Pasirinkite **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone with the link arba jūsų organizacijos pasirinkimas
6. Nukopijuokite `/exec` Web app URL ir įrašykite jį į `GOOGLE_SCRIPT_URL` faile `js/generator.js`.

## Duomenų saugojimas

- Duomenys saugomi lape `Vertinimai`.
- Stulpelis `Įkelta` naudojamas automatiniam ištrynimui.
- `cleanupOldRows()` ištrina senesnius nei 7 dienų įrašus.
- `setup()` sukuria kasdienį trigerį, kuris automatiškai paleidžia valymą.

## Patikra

Atidarius Web app `/exec` URL naršyklėje, turi būti grąžinama JSON žinutė, kad endpoint veikia. Paciento vertinimo forma siunčia duomenis per paslėptą POST formą į Apps Script Web App `/exec` adresą, nes Google Apps Script atsakymas naršyklėje dažnai nėra skaitomas per CORS. Į `GOOGLE_SCRIPT_URL` būtina įklijuoti būtent Apps Script Web App `/exec` URL, ne Google Sheets lentelės URL.
