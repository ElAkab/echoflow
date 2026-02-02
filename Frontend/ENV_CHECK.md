# Fix: "Invalid API key"

## Diagnostic

L'erreur "Invalid API key" signifie que Supabase ne reconnaît pas vos credentials.

## Causes Possibles

### 1. .env.local n'existe pas dans Frontend/
- Le fichier doit être dans `Frontend/.env.local`
- PAS dans la racine du projet

### 2. Variables mal nommées
Vérifiez que vous avez EXACTEMENT :
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

⚠️ **IMPORTANT** :
- `NEXT_PUBLIC_` prefix est OBLIGATOIRE
- Pas d'espaces autour du `=`
- Pas de guillemets autour des valeurs

### 3. Mauvaises clés copiées
Dans Supabase Dashboard :
1. Allez sur **Settings** → **API**
2. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

⚠️ NE PAS utiliser `service_role` key (elle est secrète)

### 4. Serveur non redémarré
Après modification de .env.local :
```bash
# Arrêtez le serveur (Ctrl+C)
pnpm dev
```

---

## Solution Étape par Étape

### Étape 1 : Vérifier le fichier .env.local

```bash
cd Frontend
cat .env.local
```

**Devrait afficher** :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...très longue clé...
```

**Si le fichier n'existe pas** :
```bash
cd Frontend
touch .env.local
```

### Étape 2 : Récupérer les bonnes clés

1. Ouvrez : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Menu : **Settings** (icône engrenage) → **API**
4. Section **Project URL** :
   - Copiez : `https://xxxxx.supabase.co`
5. Section **Project API keys** :
   - Copiez la clé **anon** **public** (PAS service_role)

### Étape 3 : Créer/Mettre à jour .env.local

```bash
cd Frontend
cat > .env.local << 'ENVFILE'
NEXT_PUBLIC_SUPABASE_URL=VOTRE_URL_ICI
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_ICI
ENVFILE
```

**Remplacez** :
- `VOTRE_URL_ICI` par l'URL complète
- `VOTRE_CLE_ICI` par la clé anon

### Étape 4 : Redémarrer le serveur

```bash
# Ctrl+C pour arrêter
pnpm dev
```

### Étape 5 : Re-tester

1. Ouvrez : http://localhost:3000/auth/login
2. Entrez votre email
3. Cliquez "Send Magic Link"
4. ✅ Devrait afficher : "Check your email for the login link!"

---

## Test Rapide des Credentials

Ouvrez la console navigateur (F12) sur /auth/login et tapez :

```javascript
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...')
```

**Devrait afficher** :
- URL : votre URL Supabase
- Key : début de votre clé

**Si `undefined`** → .env.local mal configuré

---

## Vérification Finale

Une fois .env.local correct :

```bash
# Dans Frontend/
cat .env.local
# Devrait montrer vos 2 variables

# Redémarrer
pnpm dev

# Tester
# → http://localhost:3000/auth/login
# → Entrer email
# → Send Magic Link
# → ✅ "Check your email!"
```

