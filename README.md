# Platformă de Învățare și Testare a Limbii Române (A1+)

Modernă, rapidă și complet adaptată pentru dispozitive mobile platformă de testare și studiu a limbii române, bazată pe materialele oficiale ANTEM (Asociația Națională a Trainerilor Europeni din Moldova).

---

## ✨ Caracteristici cheie

1. **Conținut 1:1 identic cu originalul:**
   - **20 de unități tematice complete** (de la *«1. Bine ați venit în Moldova!»* până la *«20. În ospeție»* + *«Test Final»*).
   - **405 activități interactive:** vocabular, gramatică, dialoguri, texte de lectură.
   - **259 de fișiere media:** toate înregistrările audio originale și ilustrațiile sunt integrate local (fără linkuri expirate).
   - **1.116 întrebări și spații de completat** cu răspunsurile corecte etalon.

2. **Mobile-First & Touch-Friendly (Optimizat pentru telefon):**
   - Butoane mari de acțiune și panou inferior fix (*Sticky Bottom Bar*) sub degetul mare.
   - PWA (Progressive Web App): poate fi adăugat pe ecranul principal al telefonului ca o aplicație nativă.
   - Player audio optimizat: butoane mari, derulare **«-5 secunde»** pentru reascultarea frazelor și selector de viteză (`0.8x`, `1.0x`, `1.2x`).

3. **Sistem de utilizatori & Progres individual:**
   - Suport multi-utilizator: comutare rapidă între profile de studenți sau creare de conturi noi.
   - Urmărirea progresului pe fiecare unitate (scor procentual, activități finalizate).
   - Analiză detaliată a greșelilor: secțiune dedicată pentru reluarea testelor cu scor sub 80%.

4. **Trimiterea temelor spre verificare:**
   - Studenții pot trimite răspunsuri deschise (compuneri, dialoguri scrise) direct din orice lecție.
   - Rol de **Profesor (Teacher)** cu panou de notare (1-10) și adăugare de feedback/corecturi.

5. **Gata pentru GitHub Pages & Supabase:**
   - Rulează 100% gratuit pe **GitHub Pages**.
   - Progresul funcționează offline/local prin `localStorage`, iar opțional se sincronizează prin **Supabase** (PostgreSQL în cloud).

---

## 🚀 Rulare locală

```bash
# 1. Instalare dependențe
npm install

# 2. Pornire server de dezvoltare
npm run dev
```

Aplicația se va deschide la `http://localhost:3000`.

---

## 📦 Publicare pe GitHub Pages

1. Creați un repository pe GitHub și încărcați fișierele:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Romanian Test Platform"
   git branch -M main
   git remote add origin https://github.com/<UTILIZATOR>/<REPO>.git
   git push -u origin main
   ```
2. În setările repository-ului pe GitHub:
   - Mergeți la **Settings** -> **Pages**.
   - La secțiunea **Build and deployment / Source**, alegeți **GitHub Actions**.
   - Workflow-ul inclus (`.github/workflows/deploy.yml`) va construi și publica site-ul automat la fiecare `git push`.

---

## 🗄️ Conectare Supabase (Opțional, pentru sincronizare în cloud)

1. Creați un proiect gratuit pe [supabase.com](https://supabase.com).
2. Deschideți **SQL Editor** în panoul Supabase și executați scriptul din `supabase_schema.sql`.
3. În aplicație, apăsați pe pictograma bazei de date (dreapta sus în antet) și introduceți **Project URL** și **Anon Key**.

