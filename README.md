# 🌋 Kalori Péi — Suivi calories par région

Application **gratuite**, **hors-ligne** et **sans compte** de suivi calorique,
couvrant la cuisine de **France métropolitaine et de La Réunion**, **par région
culinaire** : on choisit sa région et ses spécialités apparaissent, en plus des
plats nationaux et des aliments simples. Pensée pour fournir rapidement un
**bilan détaillé à votre diététicien(ne)**, et optimisée pour les
**Galaxy Z Fold 4 → 7** (écran externe étroit et écran interne déplié).

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
    × niveau d'activité physique (FAO/OMS), avec deux répartitions de
    macronutriments au choix :
    - **Standard ANSES 2021** (protéines 15 %, lipides 37,5 %,
      glucides 47,5 % de l'apport énergétique) ;
    - **Sportif / prise de muscle** (protéines **1,8 g/kg** de poids de corps,
      lipides 30 %, glucides le reste) + objectif **prise de masse +500 kcal/j**.
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

≈ 160 aliments et plats avec valeurs **par portion standard**, estimées à partir
de la table **CIQUAL (ANSES)** et de recettes traditionnelles.

- **Sélection par région** (📍 dans la saisie et dans les réglages) : la région
  active fait apparaître ses **spécialités**, en plus des **plats nationaux**
  (visibles partout) et des **aliments simples**. La **recherche**, elle, trouve
  tous les plats de la base, quelle que soit la région.
- **Régions culinaires** : La Réunion (caris, rougails, samoussas, bouchons,
  gâteau patate, macatia…), Île-de-France & classiques, Bretagne, Normandie,
  Nord & Ch'ti, Alsace-Lorraine, Bourgogne & Est, Savoie & Alpes, Lyon & Rhône,
  Auvergne & Centre, Sud-Ouest & Gascogne, Pays Basque, Provence & Méditerranée.
- **Plats nationaux** : steak-frites, croque-monsieur, quiche, hachis parmentier,
  pâtes bolognaise, pizza, burger, poulet rôti, omelette, kebab, viennoiseries…

- **Snacks détaillés par garniture** : les samoussas (légumes, fromage, poulet,
  viande, thon) et bouchons (porc, poulet, crevette) sont distingués — une part
  de samoussa fromage et une de samoussa poulet n'ont pas les mêmes valeurs.
- **Catégorie « Sport & protéines »** : plats simples pour le suivi des sportifs
  (prise de muscle, sèche) — blanc de poulet/dinde, steak haché 5 %, poisson
  blanc, saumon, thon au naturel, blancs d'œufs, flocons d'avoine, riz/pâtes
  complètes, fromage blanc 0 %, skyr, shaker de whey, amandes, brocolis et
  haricots verts.

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
