# Configuration Google OAuth - Guide Étape par Étape

## 🎯 Objectif
Configurer Google OAuth pour contourner le problème d'email et valider Story 1.3.

---

## Partie A : Google Cloud Console (10 min)

### Étape 1 : Créer le projet

1. Ouvrez : https://console.cloud.google.com/
2. Cliquez sur le sélecteur de projet (en haut à gauche)
3. **New Project**
4. Project name : `Brain Loop`
5. **Create**
6. Attendez quelques secondes que le projet soit créé
7. Sélectionnez le projet "Brain Loop"

---

### Étape 2 : Configurer OAuth Consent Screen

1. Menu ☰ → **APIs & Services** → **OAuth consent screen**
2. User Type : **External**
3. **Create**

**Remplissez le formulaire :**
- App name : `Brain Loop`
- User support email : **votre email personnel**
- App logo : (laissez vide pour l'instant)
- Application home page : `http://localhost:3000`
- Authorized domains : (laissez vide)
- Developer contact information : **votre email**
4. **Save and Continue**

**Scopes** :
- Cliquez **Save and Continue** (pas besoin d'ajouter de scopes)

**Test users** :
- Cliquez **Add Users**
- Ajoutez **votre email Gmail** (celui que vous utiliserez pour tester)
- **Save and Continue**

**Summary** :
- Vérifiez tout → **Back to Dashboard**

---

### Étape 3 : Créer OAuth 2.0 Credentials

1. Menu ☰ → **APIs & Services** → **Credentials**
2. **+ Create Credentials** (en haut)
3. Sélectionnez **OAuth client ID**

**Remplissez :**
- Application type : **Web application**
- Name : `Brain Loop - Development`

**Authorized JavaScript origins** :
```
http://localhost:3000
http://localhost:3001
```

**Authorized redirect URIs** (IMPORTANT) :
```
https://kuchunrwgaclpcokikcl.supabase.co/auth/v1/callback
```

4. **Create**

**Une popup s'affiche avec :**
- ✅ **Client ID** (commence par : `xxx.apps.googleusercontent.com`)
- ✅ **Client secret** (commence par : `GOCSPX-xxx`)

5. **Copiez les deux** (gardez cette fenêtre ouverte ou cliquez Download JSON)

---

## Partie B : Supabase Dashboard (2 min)

### Étape 4 : Activer Google Provider

1. Ouvrez : https://supabase.com/dashboard/project/kuchunrwgaclpcokikcl
2. Menu : **Authentication** → **Providers**
3. Trouvez **Google** dans la liste
4. Cliquez dessus pour développer

**Remplissez :**
- Toggle : **ON** (activé)
- Client ID (for OAuth) : **Collez le Client ID de Google**
- Client Secret (for OAuth) : **Collez le Client Secret de Google**

5. **Save**

---

## Partie C : Test (1 min)

### Étape 5 : Tester Google OAuth

1. Assurez-vous que le serveur Next.js tourne :
   ```bash
   cd Frontend
   pnpm dev
   ```

2. Ouvrez : http://localhost:3000/auth/login

3. Cliquez sur **"Continue with Google"**

**Ce qui devrait se passer :**
- ✅ Nouvelle fenêtre/onglet s'ouvre
- ✅ Page Google "Sign in with Google"
- ✅ Sélectionnez votre compte Gmail
- ✅ Popup de consentement "Brain Loop wants to access..."
- ✅ Cliquez **Continue**
- ✅ Redirect vers http://localhost:3000/dashboard
- ✅ Dashboard affiche votre email Gmail

4. Testez le **Logout** :
   - Cliquez sur "Logout"
   - → Devrait revenir sur `/auth/login`

5. Re-testez la connexion :
   - Cliquez "Continue with Google"
   - → Connexion instantanée (pas de popup cette fois)

---

## 🐛 Troubleshooting

### Erreur : "Access blocked: Brain Loop has not completed..."

**Cause** : Vous n'avez pas ajouté votre email aux Test users

**Solution** :
1. Google Console → OAuth consent screen
2. Section **Test users**
3. **Add Users** → Ajoutez votre Gmail
4. **Save**
5. Réessayez

---

### Erreur : "Redirect URI mismatch"

**Cause** : L'URI de callback ne correspond pas

**Solution** :
1. Vérifiez l'erreur → Elle affiche l'URI reçue
2. Google Console → Credentials → Votre OAuth Client
3. **Authorized redirect URIs** → Ajoutez exactement :
   ```
   https://kuchunrwgaclpcokikcl.supabase.co/auth/v1/callback
   ```
4. **Save**
5. Réessayez (peut prendre 1-2 min pour se propager)

---

## ✅ Checklist Configuration

- [ ] Projet Google Cloud créé
- [ ] OAuth consent screen configuré
- [ ] Test user ajouté (votre Gmail)
- [ ] OAuth 2.0 Client ID créé
- [ ] Redirect URI ajouté (Supabase callback)
- [ ] Client ID copié dans Supabase
- [ ] Client Secret copié dans Supabase
- [ ] Google provider activé (toggle ON)

## ✅ Checklist Test

- [ ] Serveur Next.js tourne (pnpm dev)
- [ ] Click "Continue with Google" fonctionne
- [ ] Redirect vers /dashboard OK
- [ ] Email affiché dans dashboard
- [ ] Logout fonctionne
- [ ] Re-login instantané

**Une fois tous ces points validés → Story 1.3 Complete** ✅
