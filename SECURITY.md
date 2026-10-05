# Sicherheitsrichtlinie

## Sicherheitslücke melden

Bitte melde Sicherheitslücken **nicht** über öffentliche Issues, sondern vertraulich über
[GitHub Private Vulnerability Reporting](https://github.com/Jonas480185/menta/security/advisories/new).

Hilfreich sind eine kurze Beschreibung, betroffene Routen oder Dateien, Schritte zur Reproduktion und
die mögliche Auswirkung. Ich melde mich in der Regel innerhalb von 7 Tagen zurück und informiere über
den Stand der Behebung.

## Unterstützte Versionen

Sicherheitskorrekturen erfolgen auf dem `main`-Branch.

## Sicherheitsmaßnahmen im Projekt

- Authentifizierung mit better-auth: gehashte Passwörter, HttpOnly-Session-Cookies, Rate-Limiting in Produktion
- Jede Server Action und jeder Route Handler prüft die Session serverseitig; alle Daten sind auf den
  angemeldeten Nutzer beschränkt (`ctx.userId`), Eigentümerschaft wird vor Änderungen geprüft
- Validierung aller externen Eingaben mit Zod, parametrisierte SQL-Abfragen über Drizzle
- Content Security Policy mit Nonce pro Request, `frame-ancestors 'none'`, weitere Security-Header
  (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- Weiterleitungsziele (`?next=`) werden auf interne Pfade beschränkt
- Konto-Löschung erfordert das Passwort; Datenexport nur für den angemeldeten Nutzer
