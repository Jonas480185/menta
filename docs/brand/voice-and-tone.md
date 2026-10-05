# Stimme & Tonalität: Menta

> Verbindlich für alle UI-Texte, Milo-Nachrichten, Fehlermeldungen, Benachrichtigungen und E-Mails.
> UI-Sprache ist **Deutsch**. Englische Varianten nur, wo ausdrücklich angegeben.
> Owner: Brand Identity. 

## 1. Kurzfassung (für alle, die nur 60 Sekunden haben)

1. **Zahlen zuerst, Wertung nie.** „1.840 von 2.100 kcal“ statt „Super gemacht!“.
2. **Sachlich und freundlich.** Kurze Sätze. Kein Marketing-Sprech. Kein Ausrufezeichen-Gewitter.
3. **Kein Essen ist gut oder schlecht.** Lebensmittel haben Nährwerte, keine Moral.
4. **Kein Kommentar zum Körper.** Wir sprechen über Daten und Trends, nie über Aussehen.
5. **Über dem Ziel ist eine Information, kein Fehler.** Keine Schuld, keine Strafe, kein Rot.
6. **Feiern: klein und konkret.** „Protein-Ziel erreicht.“, nicht „WOW, du bist unglaublich!!!“
7. **Immer ein nächster Schritt.** Leere Zustände und Fehler sagen, was jetzt geht.
8. **Du, nicht Sie.** Kleingeschrieben im Satz („dein Ziel“), großgeschrieben nur am Satzanfang.

## 2. Persönlichkeit

Menta ist wie eine gute Trainerin mit Statistik-Hintergrund: weiß viel, drängt sich nicht auf,
sagt die Wahrheit freundlich und hat hin und wieder ein leises Augenzwinkern.

| Eigenschaft | Das heißt | Das heißt nicht |
|---|---|---|
| **Ruhig** | Kurze, entspannte Sätze. Keine Dringlichkeit, wo keine ist. | Gleichgültig oder distanziert. |
| **Präzise** | Konkrete Zahlen, Einheiten, Zeiträume. „Noch 38 g Protein.“ | Pedantisch, Tabellen im Fließtext, Fachjargon. |
| **Warm** | Freundlich, zugewandt, respektiert Alltag und Kontext. | Kumpelhaft, übergriffig, „Hey Süße!“. |
| **Ermutigend** | Fortschritt sichtbar machen, nächsten machbaren Schritt anbieten. | Druck, Drill, Fitness-Bro-Motivation. |
| **Augenzwinkernd** (sparsam) | Ein trockener Halbsatz, meist von Milo, max. einmal pro Screen. | Witze über Essen, Körper oder Gewicht. Memes. |

### Stimm-Regler

```
Formell   ●●○○○  Locker        → freundlich-sachlich, du-Form
Einfach   ●●○○○  Komplex       → Alltagssprache; Fachbegriffe nur mit Kontext
Ernst     ●●●○○  Verspielt     → überwiegend ernst, verspielt nur bei Milo & Erfolgen
Zurückhaltend ●●○○○ Expressiv  → zurückhaltend; Emotion zeigt Milo, nicht der Text
```

## 3. Grundregeln für Texte

### Form
- **Satzschreibung** (Sentence case) in Buttons, Überschriften, Tabs: „Mahlzeit hinzufügen“, nicht „Mahlzeit Hinzufügen“.
- **Buttons = Verb im Infinitiv**, 1-3 Wörter: „Speichern“, „Loggen“, „Rückgängig“, „Ziel anpassen“.
- **Punkt** am Ende vollständiger Sätze, auch in Toasts („Eintrag gelöscht.“). Keine Punkte in Buttons, Labels, Tabs.
- **Ausrufezeichen:** höchstens eines pro Screen, nur bei echten Erfolgen. Standard ist der Punkt.
- **Keine Emojis** in UI-Texten. Emotion transportiert Milo.
- **Keine Gedankenstriche** im Fließtext. Lieber zwei kurze Sätze, ein Komma oder einen Doppelpunkt. Bereiche mit „bis“ („2 bis 3 Wochen“).
- **Anführungszeichen** „deutsch“, nicht "englisch".

### Zahlen & Einheiten
- Formatierung immer mit `Intl.NumberFormat('de-DE')`: `1.840 kcal`, `72,4 kg`, `1,5 l`.
- Zwischen Zahl und Einheit ein (geschütztes) Leerzeichen: `38 g`, `250 ml`, `2.100 kcal`.
- Einheiten: `kcal`, `g`, `mg`, `ml`, `l`, `kg`. Im Fließtext „Kalorien“, an Zahlen immer „kcal“.
- Nur so genau wie sinnvoll: kcal ganzzahlig, Makros ganzzahlig (unter 10 g eine Nachkommastelle),
  Gewicht eine Nachkommastelle, Wasser in `ml` unter 1 l, sonst `l` mit einer Nachkommastelle.
- Zahl vor Wort: „Noch 420 kcal“ statt „Du kannst noch 420 kcal essen“.
- Verhältnisse als „x von y“: „1.840 von 2.100 kcal“.

### Begriffe (Glossar)

| Verwenden | Vermeiden | Hinweis |
|---|---|---|
| loggen, eintragen | tracken (in UI-Texten), erfassen | „Loggen“ ist der zentrale Button. „Tracken“ nur in Marketing. |
| Tagebuch | Log, Journal, Protokoll | Route `/diary` |
| Tagesziel, Ziel | Limit, Budget, Grenze, erlaubt | Ein Ziel ist eine Orientierung, kein Verbot. |
| noch offen, noch übrig | noch erlaubt, noch „frei“ | „Noch 420 kcal offen“ |
| über dem Ziel | überschritten, zu viel, drüber | neutrale Richtungsangabe |
| Protein | Eiweiß | Konsistenz mit „Kohlenhydrate“, „Fett“ |
| Kohlenhydrate (kurz: KH) | Carbs | Kürzel nur bei Platzmangel |
| Fett | Fette | |
| Mahlzeit; Frühstück, Mittagessen, Abendessen, Snacks | Zwischenmahlzeit, Naschen | Snacks sind eine Mahlzeit wie jede andere. |
| Gewichtstrend, 7-Tage-Durchschnitt | Tagesgewicht als Erfolgsmaß | Trend > Einzelwert |
| Zielgewicht | Wunschgewicht, Traumgewicht, Idealgewicht | |
| Serie | Streak (in UI) | „7 Tage in Folge geloggt.“ |
| Lebensmittel | Food, Nahrung | |
| eigenes Lebensmittel | Custom Food | |

## 4. Wie wir über Essen und Körper sprechen

**Essen ist neutral.** Wir beschreiben Nährwerte, nicht Charakter. Pizza ist nicht „Sünde“, Brokkoli nicht „brav“.

- Keine Adjektive mit Moral: *gut, schlecht, gesund, ungesund, clean, dirty, erlaubt, verboten, Sünde, Cheat, Junk*.
- Stattdessen Fakten: „proteinreich“, „ballaststoffreich“, „energiedicht“, „viel Zucker pro Portion“, sachlich,
  ohne Unterton, und nur, wenn es für die aktuelle Aufgabe hilft.
- Keine Kompensationslogik: nie „Das musst du morgen wieder reinholen“ oder „Verbrenne es mit 40 Min. Laufen“.
- Keine Belohnungslogik: Essen ist nie Belohnung oder Strafe („Gönn dir, du hast es dir verdient“).

**Der Körper ist kein Projekt.** Wir sprechen nie über Aussehen, Figur oder Körperteile.

- Kein Vorher/Nachher, keine Körperbilder, kein „Bikinifigur“, „Problemzonen“, „Speck“, „Kampf gegen die Kilos“.
- Gewicht ist ein Messwert mit natürlichem Rauschen. Wir betonen Trend und Durchschnitt, nicht Tageswerte.
- Ziele (abnehmen, halten, zunehmen, Muskelaufbau) sind gleichwertig. Wir bewerten nicht, welches Ziel jemand hat.
- Keine medizinischen Versprechen, keine Diagnosen. Bei Warnsignalen (sehr niedrige Zufuhr) sachlich auf Energie-
  bedarf hinweisen und ggf. auf ärztlichen Rat verweisen: ohne Alarmismus.

## 5. Tonalität nach Situation

| Situation | Ton | Länge | Milo |
|---|---|---|---|
| Leerer Zustand | einladend, konkret | 1 Satz + Aktion | neutral / thinking |
| Eintrag gespeichert | knapp, bestätigend | 2-5 Wörter |: (kein Milo bei Routine) |
| Ziel erreicht | kurz, konkret, leise stolz | 1 Satz | goal_reached / happy |
| Serie / Meilenstein | warm, anerkennend, faktisch | 1-2 Sätze | streak / celebrating |
| Über dem Ziel | sachlich, entlastend, Perspektive | 1-2 Sätze | neutral / encouraging |
| Unter dem Ziel (deutlich) | fürsorglich, sachlich | 1-2 Sätze | encouraging |
| Gewichtstrend | analytisch, beruhigend | 1-2 Sätze | thinking / happy |
| Fehler | ehrlich, lösungsorientiert, ohne Schuld | 1 Satz + Aktion | thinking (nur bei ganzen Screens) |
| Onboarding | einladend, erklärend („warum wir fragen“) | 1-2 Sätze pro Schritt | wechselnd |
| Spät abends / Inaktivität | leise, ohne Druck | 1 Satz | sleepy |

### Feiern: subtil und spezifisch

- Nenne **was** erreicht wurde und **mit welcher Zahl**: „Protein-Ziel erreicht: 142 von 140 g.“
- Keine Superlative („unglaublich“, „perfekt“, „Held:in“), keine Dauerfeier. Jede Feier ist selten genug, um etwas zu bedeuten.
- Große Momente (neue Rekord-Serie, Zielgewicht erreicht) dürfen **einmal** ein Ausrufezeichen und Milo „celebrating“ bekommen.
- Kalorienziel „genau getroffen“ wird **nicht** gefeiert: das wäre Präzisionsdruck. Gefeiert werden Konsistenz
  (Serien, Loggen), Makro-Ziele, Wasser und Trends.

### Über-Ziel-Tage

- Ein Tag über dem Ziel ist normal und **kein Fehlerzustand**. Keine roten Warnfarben, keine Warn-Icons.
- Formulierung: Zahl + neutrale Richtung + Perspektive (Woche/Trend). Keine Aufforderung zum Ausgleichen.
- Nach 20 Uhr keine Zielabstands-Hinweise mehr pushen.

### Fehler

- **Was ist passiert: was kannst du tun.** In dieser Reihenfolge, kurz.
- Nie dem Menschen die Schuld geben („Du hast eine falsche Eingabe gemacht“). Wir sagen, was gebraucht wird.
- Keine technischen Codes im Haupttext. (Code optional klein darunter für Support.)
- Daten gehen nie „verloren“ ohne Hinweis: Wenn etwas nicht gespeichert wurde, sagen wir es klar.

## 6. Microcopy-Bibliothek

Platzhalter in `{geschweiften Klammern}` werden zur Laufzeit ersetzt; Zahlen immer über `Intl.NumberFormat('de-DE')`.

### 6.1 Heute / leeres Tagebuch

| Kontext | Text |
|---|---|
| Morgens, noch nichts geloggt (bis 11 Uhr) | Noch nichts geloggt. Was gab es zum Frühstück? |
| Mittags, noch nichts geloggt | Noch nichts geloggt. Fang mit deiner letzten Mahlzeit an. |
| Abends, noch nichts geloggt | Heute ist noch leer. Magst du nachtragen, was du gegessen hast? |
| Leere Mahlzeit (Frühstück) | Frühstück hinzufügen |
| Leere Mahlzeit (Snacks) | Snack hinzufügen |
| Vergangener Tag ohne Einträge | Für diesen Tag gibt es keine Einträge. |
| Zukünftiger Tag | Dieser Tag liegt noch vor dir. Du kannst schon Mahlzeiten planen. |
| Leere Suche vor Eingabe | Suche nach Lebensmitteln, Marken oder scanne einen Barcode. |
| Keine Suchtreffer | Keine Treffer für „{query}“. Prüfe die Schreibweise oder lege ein eigenes Lebensmittel an. |
| Keine Favoriten | Noch keine Favoriten. Tippe beim Loggen auf den Stern, um Lebensmittel hier zu sammeln. |
| Keine zuletzt verwendeten | Hier erscheinen deine zuletzt geloggten Lebensmittel. |
| Keine Rezepte | Noch keine Rezepte. Leg dein erstes an: wir rechnen die Nährwerte pro Portion aus. |
| Keine Gewichtseinträge | Noch kein Gewicht eingetragen. Ein Eintrag pro Woche reicht für einen ersten Trend. |
| Keine Aktivitäten | Heute noch keine Aktivität eingetragen. |
| Noch zu wenig Daten für Analysen | Nach 3 geloggten Tagen siehst du hier deine ersten Wochenwerte. |

### 6.2 Fortschritt & Ziele

| Kontext | Text |
|---|---|
| Kalorien offen | Noch {n} kcal offen |
| Kalorien Übersicht | {consumed} von {goal} kcal |
| Protein fast erreicht | Noch {n} g Protein bis zu deinem Ziel. |
| Protein-Ziel erreicht | Protein-Ziel erreicht. |
| Protein-Ziel erreicht (mit Zahl) | Protein-Ziel erreicht: {consumed} von {goal} g. |
| Ballaststoffe erreicht | Ballaststoff-Ziel erreicht. |
| Alle Makros im Zielbereich | Alle drei Makros im Zielbereich. Schön ausbalanciert. |
| Tag abgeschlossen (alle Mahlzeiten geloggt) | Tag vollständig geloggt. |
| Aktivität hinzugefügt (Kalorien werden angerechnet) | {n} kcal aus Aktivität zu deinem Tagesziel hinzugerechnet. |

### 6.3 Über dem Ziel / deutlich darunter

| Kontext | Text |
|---|---|
| Kalorien über Ziel (Label) | {n} kcal über dem Ziel |
| Über Ziel (Milo / Hinweis) | Heute {n} kcal über deinem Ziel. Für deinen Trend zählt die Woche, nicht der einzelne Tag. |
| Über Ziel, Wochenschnitt im Rahmen | {n} kcal über dem Tagesziel: dein Wochenschnitt liegt mit {avg} kcal weiter im Zielbereich. |
| Mehrere Tage über Ziel (Hinweis, sachlich) | Dein Schnitt der letzten 7 Tage liegt {n} kcal über deinem Ziel. Passt das Ziel noch zu deinem Alltag? [Ziel prüfen] |
| Protein über Ziel |: (kein Hinweis; Überschreitung von Makrozielen wird nicht kommentiert) |
| Deutlich unter Ziel, abends | Heute bist du deutlich unter deinem Ziel. Dein Körper braucht Energie: vielleicht passt noch eine Mahlzeit. |
| Wiederholt sehr niedrige Zufuhr | Deine Zufuhr lag an mehreren Tagen deutlich unter deinem Bedarf. Sprich bei Unsicherheit gern mit einer Ärztin oder einem Arzt. |

### 6.4 Serien (Streaks)

| Kontext | Text |
|---|---|
| Serie läuft | {n} Tage in Folge geloggt. |
| 7 Tage | 7 Tage in Folge geloggt. |
| Meilenstein 30 Tage | 30 Tage in Folge geloggt. Das ist jetzt Routine. |
| Neue längste Serie | Neue längste Serie: {n} Tage! |
| Serie in Gefahr (abends, heute nichts geloggt) | Deine Serie läuft seit {n} Tagen. Ein Eintrag heute hält sie am Laufen. |
| Serie gerissen | Neuer Tag, neuer Anlauf. Deine längste Serie bleibt: {best} Tage. |
| Rückkehr nach Pause | Schön, dass du wieder da bist. Fang einfach mit der nächsten Mahlzeit an. |

### 6.5 Gewicht

| Kontext | Text |
|---|---|
| Trend Richtung Ziel | Dein 7-Tage-Durchschnitt bewegt sich in Richtung deines Ziels. |
| Trend Richtung Ziel (mit Zahl) | Dein 7-Tage-Durchschnitt ist um {delta} kg gesunken: in Richtung deines Ziels. |
| Trend stabil | Dein 7-Tage-Durchschnitt ist stabil. |
| Trend stabil, Ziel = halten | Dein Gewicht ist stabil: genau wie geplant. |
| Trend entgegen dem Ziel | Dein 7-Tage-Durchschnitt ist um {delta} kg gestiegen. Schwankungen sind normal: schau dir den Verlauf über 2-3 Wochen an. |
| Tagessprung nach oben | Tageswerte schwanken um 1-2 kg: Wasser, Salz, Verdauung. Entscheidend ist der Trend. |
| Eintrag gespeichert | Gewicht eingetragen: {kg} kg. |
| Zielgewicht erreicht | Zielgewicht erreicht! Magst du ein neues Ziel setzen oder dein Gewicht halten? |
| Erinnerung (opt-in) | Zeit fürs Wiegen? Am besten morgens, zur gleichen Uhrzeit. |

### 6.6 Wasser

| Kontext | Text |
|---|---|
| Fortschritt | {current} von {goal} l getrunken |
| Schnell hinzufügen | + 250 ml |
| Hinzugefügt | 250 ml Wasser hinzugefügt. |
| Wasserziel erreicht | Wasserziel erreicht. |
| Noch nichts getrunken (Nachmittag, sanft) | Heute noch kein Wasser eingetragen. Ein Glas zwischendurch? |

### 6.7 Bestätigungen (Toasts)

| Kontext | Text | Aktion |
|---|---|---|
| Eintrag hinzugefügt | {food} zu {meal} hinzugefügt. | Rückgängig |
| Eintrag gespeichert (bearbeitet) | Eintrag gespeichert. | – |
| Eintrag gelöscht | Eintrag gelöscht. | Rückgängig |
| Mehrere gelöscht | {n} Einträge gelöscht. | Rückgängig |
| Rückgängig gemacht | Wiederhergestellt. | – |
| Mahlzeit kopiert | {meal} auf {date} kopiert. | Rückgängig |
| Favorit hinzugefügt | Zu Favoriten hinzugefügt. | – |
| Favorit entfernt | Aus Favoriten entfernt. | Rückgängig |
| Lebensmittel angelegt | {food} angelegt. | Jetzt loggen |
| Rezept gespeichert | Rezept gespeichert. | – |
| Ziele aktualisiert | Ziele aktualisiert. Gilt ab heute. | – |
| Einstellungen gespeichert | Gespeichert. | – |

Destruktive Bestätigungsdialoge (nur für nicht rückgängig machbare Aktionen):

- Titel: „Rezept löschen?“ · Text: „{name} wird dauerhaft gelöscht. Bereits geloggte Einträge bleiben erhalten.“ · Buttons: „Löschen“ / „Abbrechen“
- Titel: „Konto löschen?“ · Text: „Alle deine Daten werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.“ · Buttons: „Konto löschen“ / „Abbrechen“

Einzelne Tagebuch-Einträge werden **ohne Dialog** gelöscht: mit Rückgängig-Toast.

### 6.8 Fehler

| Kontext | Text | Aktion |
|---|---|---|
| Keine Verbindung | Keine Verbindung. Deine Eingabe ist noch da: versuch es gleich noch einmal. | Erneut versuchen |
| Speichern fehlgeschlagen | Das hat nicht geklappt. Dein Eintrag wurde nicht gespeichert. | Erneut versuchen |
| Unerwarteter Fehler (Seite) | Da ist etwas schiefgelaufen. Wir haben nichts von deinen Daten verändert. | Neu laden |
| Seite nicht gefunden | Diese Seite gibt es nicht (mehr). | Zu Heute |
| Barcode nicht gefunden | Diesen Barcode kennen wir noch nicht. Leg das Produkt an: dann ist es beim nächsten Scan da. | Produkt anlegen |
| Kamera nicht verfügbar | Wir können nicht auf die Kamera zugreifen. Erlaube den Zugriff in den Browser-Einstellungen oder gib den Barcode ein. | Barcode eingeben |
| Externe Datenbank langsam | Die Produktdatenbank antwortet gerade langsam. Lokale Treffer siehst du schon. | – |
| Pflichtfeld leer | Bitte gib {feld} an. | – |
| Ungültige Zahl | Bitte gib eine Zahl ein, z. B. 125 oder 12,5. | – |
| Wert außerhalb des Bereichs | Bitte gib einen Wert zwischen {min} und {max} {einheit} ein. | – |
| Nährwerte unplausibel | Die Makros ergeben {calc} kcal, angegeben sind {given} kcal. Stimmt das so? | Trotzdem speichern / Prüfen |
| Sitzung abgelaufen | Du wurdest abgemeldet. Melde dich an, um weiterzumachen. | Anmelden |
| Login fehlgeschlagen | E-Mail oder Passwort stimmen nicht. | – |
| Zu viele Versuche | Zu viele Versuche. Bitte warte kurz und versuch es dann erneut. | – |

### 6.9 Onboarding

| Schritt | Überschrift | Hilfstext |
|---|---|---|
| Willkommen | Willkommen bei Menta. | Ich bin Milo. Ich helfe dir, deine Ernährung klar im Blick zu behalten: ohne Druck. |
| Ziel wählen | Was möchtest du erreichen? | Abnehmen, Gewicht halten, zunehmen oder Muskeln aufbauen. Du kannst das jederzeit ändern. |
| Körperdaten | Ein paar Angaben zu dir | Daraus berechnen wir deinen Energiebedarf. Deine Daten bleiben privat. |
| Aktivität | Wie aktiv ist dein Alltag? | Denk an einen normalen Tag: Sport tragen wir später separat ein. |
| Tempo | Wie schnell soll es gehen? | Ein moderates Tempo ist leichter durchzuhalten. Wir empfehlen {rate} kg pro Woche. |
| Ergebnis | Dein Tagesziel: {kcal} kcal | Aufgeteilt auf {p} g Protein, {c} g Kohlenhydrate und {f} g Fett. Du kannst alles anpassen. |
| Mahlzeiten | Deine Mahlzeiten | Frühstück, Mittagessen, Abendessen und Snacks: benenne sie um oder füge eigene hinzu. |
| Fertig | Alles bereit. | Fang mit deiner nächsten Mahlzeit an. |

Buttons: „Weiter“, „Zurück“, „Überspringen“ (nur optionale Schritte), am Ende „Los geht’s“.

### 6.10 Milo: Beispiel-Nudges

Milo spricht in der ersten Person, kurz, und immer mit Nutzen (Information oder machbarer nächster Schritt).

| Zustand | Beispiel |
|---|---|
| neutral | Guten Morgen. Heute sind {goal} kcal dein Ziel. |
| thinking | Dir fehlen noch {n} g Protein. Skyr, Linsen oder Tofu wären eine einfache Ergänzung. |
| encouraging | Heute war mehr los als geplant. Morgen ist ein neuer Tag: dein Wochentrend passt. |
| happy | Wasserziel erreicht. |
| celebrating | 30 Tage in Folge geloggt. Das ist jetzt Routine! |
| streak | 7 Tage in Folge. Ich hab mitgezählt. |
| goal_reached | Protein-Ziel erreicht. |
| sleepy | Späte Mahlzeit? Ich trag sie gern noch für heute ein. |

### 6.11 Erinnerungen (opt-in, max. 1 pro Tag pro Typ)

- Mittag: „Schon Mittag gegessen? Ein kurzer Eintrag reicht.“
- Abend: „Magst du den Tag noch vervollständigen?“
- Wiegen (wöchentlich): „Zeit fürs Wiegen? Am besten morgens, zur gleichen Uhrzeit.“

Nie: „Du hast heute noch nichts eingetragen!“, „Deine Serie ist in Gefahr!!!“, Countdown-Druck.

## 7. Verbotene Formulierungen

| Nie so | Warum | Besser |
|---|---|---|
| Du warst heute schlecht. | Moralisiert die Person | Heute {n} kcal über deinem Ziel. Für deinen Trend zählt die Woche. |
| Du warst heute brav / gut. | Moralisiert (auch positiv) | Heute im Zielbereich. |
| Du hast dein Limit überschritten! | „Limit“ + Ausrufezeichen = Alarm | {n} kcal über dem Ziel |
| Achtung: zu viele Kalorien! | Alarmismus | {n} kcal über dem Ziel |
| Sündigen, Sünde, Cheat Day, Cheat Meal | Diätkultur, Schuld | Kein Ersatz nötig: Essen einfach loggen. |
| gesunde / ungesunde Lebensmittel | Moralische Bewertung | proteinreich, ballaststoffreich, energiedicht … (sachlich, nur wenn hilfreich) |
| clean eating, Junkfood, Dickmacher | Diätkultur | konkrete Nährwerte nennen |
| Das musst du morgen wieder reinholen. | Kompensation, Schuld | Morgen ist ein neuer Tag: dein Wochentrend zählt. |
| Verbrenne es mit 40 Minuten Joggen. | Sport als Strafe | (nichts: kein Hinweis) |
| Gönn dir, du hast es dir verdient! | Essen als Belohnung | (nichts: kein Hinweis) |
| Nur noch 3 kg bis zur Traumfigur! | Körperbild | Noch {n} kg bis zu deinem Zielgewicht. |
| Bikinifigur, Problemzonen, Speck, Kampf gegen die Kilos | Körperscham | (nicht verwenden) |
| Du hast zugenommen. | Wertend, ignoriert Rauschen | Dein 7-Tage-Durchschnitt ist um {delta} kg gestiegen. Schwankungen sind normal. |
| Du hast versagt / Serie verloren! | Scham | Neuer Tag, neuer Anlauf. Deine längste Serie bleibt: {best} Tage. |
| Du hast vergessen zu loggen. | Schuldzuweisung | Heute ist noch leer. Magst du nachtragen? |
| Ungültige Eingabe. | Unklar, schuldzuweisend | Bitte gib eine Zahl ein, z. B. 125 oder 12,5. |
| Fehler 500 / Request failed | Technisch | Das hat nicht geklappt. Dein Eintrag wurde nicht gespeichert. |
| WOW! Unglaublich! Du bist ein:e Held:in! | Übertrieben, entwertet echte Erfolge | Protein-Ziel erreicht. |
| Perfekt! Genau dein Kalorienziel getroffen! | Präzisionsdruck | (nicht feiern) |
| Noch 400 kcal erlaubt. | Verbotslogik | Noch 400 kcal offen |
| Diät | Diätkultur | Ziel, Ernährung |

## 8. Schnelltest vor dem Commit

Frag dich bei jedem Text:

1. Steht die relevante Zahl drin: und zwar vorne?
2. Würde sich jemand an einem schlechten Tag davon beschämt fühlen?
3. Bewertet der Text Essen oder Körper? → umschreiben.
4. Gibt es einen nächsten Schritt (Button, Link, Hinweis)?
5. Könnte man es kürzer sagen?
6. Klingt es nach Menta: oder nach einer x-beliebigen Diät-App?

## 9. English variant (reference only)

The UI is German. Where English copy is needed (store listings, OG texts), keep the same rules:
numbers first, neutral about food and bodies, calm, specific celebrations.
Tagline: *Clarity on your plate.* · Examples: “Nothing logged yet. What was breakfast?” · “Protein goal reached.” ·
“7 days logged in a row.” · “Your 7-day average is moving toward your goal.” · “412 kcal over today’s goal. Your weekly trend is what counts.”
