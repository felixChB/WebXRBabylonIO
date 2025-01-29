## Test 1

## Test 2

### Probleme

#### Bugs
- Anzeige Bug, dass Texturen nicht laden
    - Wände sind nicht mehr Transparent -> Spiel wird dadurch unspielbar
    - kann durch Neuladen behoben werden
- VR-Brille verliert die Wlan-Verbindung (vor allem Pico 4)
    - zeigt selbst nach Neuverbindung "keine Internetverbindung" bei richiger IP
    - mehrmaliges Neuverbinden notwendig um zu fixen
    - nur bei Wlan ohne Internet der Fall (verbindet nicht automatisch)

#### Performance
- Controller, Paddles und Ball ruckeln leicht
    - teils starkes Ruckeln
    - schlimmer bei schnellen Bewegungen
    - vermutlich Wlan/Verbidnungsproblem, da sonstige Szene stabil

#### Nutzerverhalten
- Bodenhöhe und Paddle
    - Nutzer bewegen das Paddle nicht bis zum Boden
    - sagen, dass sie nicht bis ganz unten kommen
    - Nutzer haben teils Probleme mit schnellen Hoch-Runter-Bewegungen in VR
    - Spielfeld höher setzen?
    - Scaling der Paddle Position zum Controller anpassen?
- Zentrieren
    - Knopf zum Zentrieren wird nicht gefunden oder verwechselt (mit A oder B)
    - denken sie müssen mit dem Controller zeigen
    - Vorzentrieren Möglich? GLeiche Spielerposition und gleiche Brille?
- Absetzen
    - Nutzer setzen Brille oft einfach ab, ohne aus dem Spiel zu gehen
    - Folge: Spieler bleibt im Spiel und die Wand bleibt offen
    - extra sagen, dass das Spiel beendet werden soll?
    - Seite neuladen wenn Brille abgesetz wird?
    - ganze Szene in VR bleiben, auch wenn Brille neu aufgesetzt wird?
- Auswahl
    - Probleme bei der Auswahl der Positionen da Knöpfe verwechselt werden
    - finden den Knopf für den Zeigefinger nicht
- Spielerfeld
    - Spielerfeld bzw. Abgrenzung im Siel wird oft nicht erkannt
    - erkenntlichere Barriere?
    - für manche zu nah und für manche zu weit weg vom SpielCube
- ein Nutzer dachte er muss die Wand/das Paddle berühren
- Nutzer haben teils das Gefühl, dass mehr Funktionen eingebaut sind
    - Curve-Ball möglich
    - Ball durch Knopfdruck beschleunigen
- Erklärung und Monitoring
    - Erklärung, was gedrückt werden soll schwierig und für manche sehr kompliziert
    - keine Einsicht was Spieler genau sehen und worauf sie zeigen
    - Kinder und Nutzer ohne vorherige VR-Erfahrungen haben meist größere Schwierigkeiten
    - Schwer zu diffenrenzieren ob Bug oder Missverständnis ohne Brille selbst aufzuziehen
    - Zentrierung und Auswahl für Nutzer übernehmen (nach Nutzerwechsel)?

### Anmerkungen/Ideen

- Musik/Sounds (futuristische Sounds, schnelle (Party-)Musik)
- den Ball anstoßen/Impuls geben
- von VR zu AR
- Paddle zwischen rechtem und linkem Controller aufspannen und Größe anpassen
- Minuspunkte bei Miss als aktueller Score
- nur den rechten Controller nehmen (nur einen)
- die Meisten finden eine Art Avatar für andere Spieler gut
- für Linkshänder Möglichkeit mit Links zu steuern einbauen

### Was war gut

#### Schöne Optik
- Lichteffekte an den Wänden
- coole Umgebung
- Blöcke passen optisch
- Höhendesign (Startblöcke) funktioniert gut
#### Interface
- cooles Interface
- gute Menüauswahl
#### Gameplay
- macht Spaß
- könnten es lange Spielen