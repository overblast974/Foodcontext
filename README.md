# 🌋 Kalori Péi — Suivi calories · La Réunion

Application **gratuite**, **hors-ligne** et **sans compte** de suivi calorique,
spécialisée dans la cuisine de **La Réunion** (caris, rougails, grains, brèdes,
samoussas, bouchons…). Pensée pour fournir rapidement un **bilan détaillé à votre
diététicien(ne)**, et optimisée pour les **Galaxy Z Fold 4 → 7** (écran externe
étroit et écran interne déplié).

## ✨ Fonctionnalités

- **Saisie par vignettes** : 1 appui = 1 dose classique, ré-appuyez pour
  augmenter, ajustement fin par pas de 0,5 dose dans le « plat en cours ».
- **Appui long sur une vignette** : fiche nutritionnelle complète + ajout d'une
  **photo personnelle** (appareil photo ou galerie, stockée sur le téléphone).
- **Compte rendu du plat** à la validation : calories totales, macronutriments
  (protéines, glucides, lipides) et micronutriments (fibres, sel, calcium, fer,
  magnésium, potassium, vitamine C).
- **Bilan journalier** : barres de progression vs objectifs, détail par repas.
- **Bilan hebdomadaire** : détail jour par jour, moyennes journalières,
  **export PDF** (bouton « Télécharger le bilan PDF » → Enregistrer au format PDF)
  à remettre à la diététicienne.
- **Objectifs journaliers** :
  - *Saisie manuelle* (recommandé) : valeurs prescrites par la diététicienne ;
  - *Calcul automatique* : métabolisme de base **Mifflin-St Jeor (1990)**
    × niveau d'activité physique (FAO/OMS), répartition des macronutriments
    selon les repères **ANSES 2021** (protéines 15 %, lipides 37,5 %,
    glucides 47,5 % de l'apport énergétique).
- **Aliments personnalisés** : ajoutez vos propres plats avec leurs valeurs.
- **100 % local** : aucune donnée n'est envoyée sur internet
  (`localStorage` + export/import JSON de sauvegarde).
- **PWA installable** : fonctionne hors-ligne, s'installe comme une vraie
  application.

## 📱 Installation sur le Galaxy Z Fold

1. Hébergez le dossier (voir ci-dessous) et ouvrez l'URL dans **Chrome** ou
   **Samsung Internet** sur le téléphone.
2. Menu ⋮ → **« Ajouter à l'écran d'accueil »** / **« Installer l'application »**.
3. L'app s'ouvre en plein écran, fonctionne hors-ligne et s'adapte
   automatiquement à l'écran externe (3 colonnes de vignettes) et à l'écran
   interne déplié (vignettes à gauche, plat en cours à droite, gestion de la
   pliure).

## 🌐 Hébergement gratuit (GitHub Pages)

Le projet est 100 % statique (aucun build, aucun serveur) :

1. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**,
   choisissez la branche et le dossier `/ (root)`.
2. L'app est servie sur `https://<utilisateur>.github.io/<repo>/`.

Tout autre hébergeur statique gratuit fonctionne (Netlify, Cloudflare Pages…).
HTTPS est requis pour l'installation PWA et le mode hors-ligne.

### Test local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## 🍛 Base alimentaire

≈ 60 aliments et plats réunionnais avec valeurs **par portion standard**,
estimées à partir de la table **CIQUAL (ANSES)** et de recettes traditionnelles :
riz/zambrocal, grains (lentilles de Cilaos, haricots rouges, pois du Cap),
caris (poulet, poisson, camarons, ti-jacques…), rougail saucisses/morue,
civet zourite, cabri massalé, boucané, sarcives, brèdes, achards, rougails
d'accompagnement (tomate, mangue, dakatine), gratin chouchou, samoussas,
bouchons, bonbons piment, fruits péi (letchis, mangue, ananas Victoria,
goyaviers…), gâteau patate, macatia, boissons (jus, Dodo, rhum arrangé…).

> ⚠️ Les valeurs sont **indicatives** (les recettes familiales varient) et ne
> remplacent pas l'avis d'un professionnel de santé. À propos des photos de
> plats : les images trouvées sur Google sont protégées par le droit d'auteur ;
> l'app permet à la place d'ajouter **vos propres photos**, prises avec le
> téléphone et stockées localement.

## 🗂️ Structure

```
index.html            Application (4 vues : Saisie, Jour, Semaine, Réglages)
css/style.css         Styles + media queries Z Fold + feuille d'impression PDF
js/foods.js           Base alimentaire réunionnaise (valeurs par portion)
js/app.js             Logique : stockage local, bilans, objectifs, photos
manifest.webmanifest  Manifeste PWA
sw.js                 Service worker (hors-ligne, cache-first)
icons/                Icônes (SVG + PNG générés par tools/make_icons.py)
```
