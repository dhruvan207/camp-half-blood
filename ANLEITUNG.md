# Anleitung – Camp Half-Blood

**Deine Website:** https://dhruvan207.github.io/camp-half-blood/
**QR-Code zum Drucken:** Ordner `druck/` → `qr-druck.html` im Browser öffnen und auf „Drucken“ klicken (oder `qr-code.png` ins Plakat einfügen).

Die Website funktioniert für alle, überall, auch wenn dein Mac aus ist.
Besucher können nur schauen, **nichts ändern**.

---

## 1. Texte ändern

Texte änderst du nur auf deinem Mac:

1. Terminal öffnen und die Vorschau starten:
   ```
   cd ~/camp-half-blood
   npm run dev -- --host
   ```
2. Im Browser **http://localhost:5173** öffnen.
3. Figur oder Haus antippen → **„✏️ Text bearbeiten“** → Text ändern → **„Speichern“**.
   Wenn „Gespeichert ✓“ erscheint, steht der Text in der Datei `public/content.json`.
4. Die Vorschau beenden: im Terminal **Ctrl + C** drücken.

**Bilder:** Bilddatei in den Ordner `public/bilder/` legen und im Feld „Bild“ nur den Dateinamen eintragen, z. B. `percy.jpg`. Nur eigene oder freie Bilder verwenden, keine Bilder aus den Filmen.

> Online ändert sich erst etwas, wenn du die neue Version hochlädst (Schritt 2).

---

## 2. Änderungen online bringen

Im Terminal im Projektordner:

```
cd ~/camp-half-blood
npm run online
```

Das baut die Website und lädt sie hoch. Nach **1–2 Minuten** ist die neue Version online
(eventuell auf dem Handy die Seite einmal neu laden).

Zur Sicherung zusätzlich deine Änderungen speichern und auf GitHub legen:

```
git add -A
git commit -m "Texte geändert"
git push
```

---

## 3. Was tun, wenn die Seite nicht lädt?

- **Seite neu laden** (auf dem Handy nach unten ziehen oder Neu-laden-Knopf).
- **Internet prüfen:** Ohne Internet lädt die Seite nicht. Beim ersten Laden werden ca. 7 MB geladen, im Mobilfunk kann das ein paar Sekunden dauern.
- **Anderen Browser probieren:** Safari, Chrome oder Firefox, möglichst aktuell. Sehr alte Handys ohne 3D-Grafik zeigen einen Hinweis statt der Szene.
- **Roter Hinweis oben „In content.json ist ein Fehler“:** In der Textdatei fehlt meist ein Komma oder ein Anführungszeichen. Die Zeilennummer steht im Hinweis. Fehler beheben, dann `npm run online`.
- **Nach `npm run online` noch die alte Version?** 2 Minuten warten und neu laden.
- **GitHub fragt nach Anmeldung?** Im Terminal `gh auth login --hostname github.com --git-protocol https --web` ausführen und den Code im Browser bestätigen.
- **QR-Code geht nicht?** Prüfen, ob die Adresse unter dem QR-Code auf der Druckseite im Browser funktioniert. Der QR-Code enthält genau diese Adresse.

---

## Befehle auf einen Blick

| Was | Befehl |
|---|---|
| Vorschau am Mac (Texte bearbeiten) | `npm run dev -- --host` |
| Website online aktualisieren | `npm run online` |
| QR-Code und Druckseite neu erzeugen | `npm run qr` |
