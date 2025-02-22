# Network-performance Testing

## Versuch 1

Ping-Pong Message zwischen Server und Client. Startet alle 500ms auf Server-Seite und wird dann beim Server wieder ausgegeben. Gesendet wird der Timestamp und die ClientID um beides in der Console ausgeben zu lassen.
Getested wird mit dem Lynksys Router ohne Internet verbindung. Der Router ist mit einem LAN-Kabel mit dem Computer verbunden. Heimrechner.

### Ergebnis 1

Große Unterschiede der Roundtime wenn das Spiel von mindestens einem Nutzer gestartet wurde (Nutzer spielt VR-Pong) und wenn alle Nutzer im Warteraum sind.
Localhostspieler auf dem Computer muss ausgenommen werden, da dieser unabhängig vom Spiel immer eine Roundtime von 0ms oder 1ms hat.

Roundtime Warteraum: ~120ms
-> Die Roundtime, wenn sich alle Spieler im Warteraum befinden, schwankt zwischen 28ms und 700ms. Durchschnittlich etwa 100-200ms. Einzelne Spikes können auch bis 700ms gehen.

Roundtime Spiel: ~6ms
-> Roundtime schwankt meistes zwischen 4ms und 11ms. Deutlich geringer als im Warteraum. Spikes gehen trotzdem teilweise bi zu 250ms. Sind jedoch eher seltener.

## Versuch 2

Ping-Pong Message dieses mal mit Server to Client und Client to Server Zeit, um hier etwaige Unterschiede festzustellen. Außerdem werden bei spielenden Spielern die Spielerdaten mitgesendet, um Unterschiede bei der Message-Größe zu testen.