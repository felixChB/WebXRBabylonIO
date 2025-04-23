# Ergebnisse Thesis

Zusammentragen der Schwerpunkte/Probleme, welche sich bei der Thesis bzw Recherche dazu ergeben haben.
Was wurde gemacht dazu und welche Ergebnisse bzw. Erkenntnisse wurden gewonnen.

## Recherche

Die ersten Recherchen zum Thema stellten unterschiedliche Bereiche zu den Hauptthemen der Thesis.
- Multiplayer
    - Wie funktioniert die Kommunikation der Brillen?
    - Welche Art von Server?
    - Art der Übertragung
    - Anzeige der anderen Spieler
- Co-Located
    - Positionierung im Raum (Rotation und Position)
    - relativ oder fix im Raum
    - wie kann das umgesetzt werden?
- Base Design
    - Platzhalter zum Testen der Technischen Fragen (VR-PONG)
    - Warum VR-PONG? Leichte Interaktion und Verständlichkeit
    - Verschiedene Interaktionsstufen (man Interagiert direkt miteinander, indirekt über gleiche Objekte [kann sich aber berühren], mit Abstand etc)
- WebXR (Web allgemein für VR)
    - Web3D-Frameworks (Vergleiche, WebXR Integration, Community)
    - Was bietet WebXR?


## Test 1

In Test 1 wurden verschiedene Problembereiche indentifieziert, welche sich als Schwierigkeiten für die Erstellung und Distribution von co-located Multiplayer-VR-Applications mit Web Technologien herausstellten:

1. Positionierung/Einstieg (co-located)
    - Die Headsets müssen intern perfekt zentriert sein, wenn die Nutzer die Szene in VR betreten
    - leichte Drehungen oder falsche Position verschieben die Szene
    - Nutzer müssen beim Einstieg eine spezifische Position einnehmen
2. Performance
    - bewegte Objekte ruckelt alle leicht
    - teils große Sprünge der Objekte
3. Headsets
    - Headsets funktionieren unterschiedlich gut mit dem Setting
    - Probleme mit dem Verbinden mit dem WLAN
    - Probleme mit WebXR (VIVE XR Elite)
    - Neuausrichtung der Brille
    - Neuzeichnen der Boundaries
4. Co-Design
    - Gleichzeitig entwickeln und testen gemeinsam
    - Probleme bei dem Neueinstieg
    - Probleme beim Neuladen

## Test 2

5. Monitoring
    - die erschwerte Möglichkeit, zu sehen was die Nutzer sehen
    - welche Bugs ergeben sich durch die Brille und welche durch den Code
    - wo befindet sich der Nutzer
    - welche Tasten drückt der Nutzer und wie können ihm geziehlte Hilfestellungen gegeben werden (auch visuell im Headset)

## Ergebnisse für die einzelnen Themenbereiche

1. Positionierung/Einstieg
- Es wurde die Manuelle Auswahl einer Position getestet, sowie auch die vorausgewählte Position
- VR und AR als Einstieg (ungewollt auch im Spiel)
- Manuelle Auswahl:
    - Drehung und Positionierung müssen bei jedem neuen Spieleintritt exakt sein
    - es muss immer die richtige Position ausgewählt sein
    - Spieler müssen beim Spielbeginn auf einem bestimmten Feld stehen
    - Spieler müssen vor Spieleintritt selbst die Ausrichtung manuell zentrieren
-> Oft verschobene Spielfelder, Spieler verstehen die Auswahl nicht

- vorausgewählter Einstieg:
    - Das Headset befindet sich bereits im AR Modus im Spiel
    - Nutzer müssen das headset nur aufziehen und auf eine Position laufen
    - Ausrichtung einmal voreingestellt
    - Jeder Nutzer kann jederzeit jede Position einnehmen, ohne AR/VR zu verlassen
-> Headset setzen die Ausrichtung zurück, Begrenzungen werden zurückgesetzt und verhindern das herumlaufen
-> Spiel kann auch in AR zentriert werden, aber dann nur auf der richtigen Position, führt zu Verwirrung

- Ausrichtung der Szene durch Image/Marker Tracking nicht möglich, da kein Zugriff auf die Kameradaten
- Button zum Zentrieren (Plattform Button) kann mit WebXR nicht getracked werden
- Neuausrichtung der Szene durch code nicht gefunden ob möglich

2. Performance
- gibt Literatur welches Web3D Framework performanter ist
- wenig Infos zur Performance von WebXR auf den Headsets allgemein
- Tests mit FPS, Renderloops und Netzwerk
- zeigen Korrelationen bei großen Lags zum Netzwerk (Server-Round-Trip-Time)
- Allgemein Ruckler bei bewegten Objekten noch keine Ursache gefunden

3. Headsets
- Headsets funktionieren unterschiedlich gut mit dem Szenario
- Probleme mit WebXR:
-> VIVE XR Elite wird nicht getracked (kann nicht spielen)
-> Quest 3 wird nicht getracked, wenn ein Controller läd
- Probleme mit dem Wlan
- Wlan hat kein Internet und kein Passwort
-> Brillen verbinden sich nicht automatisch und verlieren teils im Ruhezustand schnell die Verbindung (disconnecten sich)
-> besonders Pico 4 Ultra anfällig für disconnects
-> VIVE XR Elite läd die Webseite nicht

4. Co-Desing/Development
- erster Test zum Co-Design
-> funktioniert und neue Funktionen können schnell getestet werden
-> Probleme beim Reload der Seite durch exitVR gefixt
-> Spieler können ihre alte Position nicht einnehmen und müssen eventuell neu zentrieren
-> Spieler müssen immer neu und manuell in die XR-Umgebung
- Best Practices von z.B.: Meta heben iteratives Design hervor

5. Monitoring
- das Bild des VR-Headsets kann durch Software auf die Brille gestreamt werden
-> so wäre Monoring möglich und man könnte mitverfolgen was der Nutzer genau sieht
- sonst Monitoring nur begrenzt angegangen
- Versuch die Notwendigkeit von Monitoring zu reduzieren
    - weniger Interaktionen zum Spielen notwendig (automatischer Einstieg)
    - so weniger fehlauswahl
-> Möglichkeit wäre alle Nutzer-Eingaben zu tracken
    -> nicht ganz möglich, da die Plattform Buttons nicht getracked werden können
-> es sind keine manuellen Hinweise auf der Brille möglich
- Problem ist auch, dass die Nutzer sich im System befinden und nicht nur in einer App
    - keine Möglichkeit Buttons zu blockieren?

## Wo fehlen Ergebnisse? / Ausblick?

- Einstieg
    - evtl noch weitere Tests mit 'unbound', Boundary umgehen
- Performance
    - warum lagt es immer?
    - welche Router geben ein bessers Ergebnis?
    - Server Hardware entscheidend?
- Headsets
    - Probleme mit der WLAN Verbindung testen (Internet, Passwort)
    - Frameworks mit Headsets testen
- Co-Design/Dev
    - Effizienz so eines Prozesses
    - klare Vor- bzw Nachteile (Praxis)
- Monitoring
    - Wie machen es andere VR-Installationen oder Events?
    - Bild streaming probieren?