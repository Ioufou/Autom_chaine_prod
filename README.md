# 📂 Rendu "Automatisation de la chaîne de production"

 Application web capable de récupérer un log sous format CSV pour l'enregistrer dans une base de données, afin de permettre de faire des recherches à partir d'une entrée texte et faire remonter les résultats correspondants.

## Fonctionnalités

- ⏳ **Upload Asynchrone** - Prise en charge de fichiers CSV volumineux (20Mo+) sans timeout, avec traitement en arrière-plan.
- 🌳 **Visualisation Hiérarchique** - Reconstitution automatique de l'arborescence des dossiers à partir des chemins ```Source``` des logs.
- 🚀 **Gestion des Doublons** - Détection des fichiers CSV déjà importés, avec option pour écraser les données existantes.
- 🔎 **Recherche Avancée** - Filtrage REGEX par nom de logs, chemin source, titre, ou statut.
- 📥 **Gestion des Fichiers CSV** - Affichage des fichiers importés dans une liste latérale avec option de suppression et possibilité de lancer une recherche sur son nom en cliquant dessus.
- 💡 **Indicateurs Visuels** - Coloration automatique, Remontée des erreurs (un dossier devient rouge si un fichier enfant est en erreur, vue hiérarchique uniquement), Affichage de la taille des fichiers.

## Stack Technique

L'application repose sur une architecture micro-services grâce à Docker Compose
- ✨ **Frontend** - HTML, CSS3, JavaScript, Nginx
- 💻 **Backend** - Python, C-Sharp
- 📚 **DB** - MangoDB
- 📮 **Messages Queue** - Redis
- 📦 **Containerisation** - Docker & Docker Compose

## Lancement
Il faut exécuter les lignes suivantes pour lancer le projet :

```sh
git clone https://github.com/Ioufou/Autom_chaine_prod.git
cd ./Autom_chaine_prod/
sudo docker compose up --build -d
```
Les dépendances s'installeront automatiquement.
Après ça, il faut accéder depuis un navigateur à ```http://localhost:8080```

## Structure des fichiers

```
├── csharp-worker/
│   ├── Dockerfile
│   ├── Program.cs
│   └── Worker.csproj
├── frontend/
│   ├── Dockerfile
│   ├── favicon.ico
│   ├── index.html
│   ├── nginx.conf
│   ├── script.js
│   └── styles.css
├── python-service/
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## Format CSV

Le format minimum du fichier CSV doit contenir :

| Nom | Description |
|--------|------|
| `Title` | Nom du fichier ou du dossier |
| `Source` | Chemin complet (```/un/chemin/complet```) |
| `Type` | ```File``` ou ```Folder``` |
| `Status` | ```Successful``` ou ```Error``` |
| `Size` | Taille du fichier |

###### README édité à l'aide de https://readmestudio.zenui.net/editor
