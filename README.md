# Garage Workflow

Application web/mobile de gestion de workflow pour garage / magasin de véhicules.

**Stack :** Next.js 15 · Tailwind CSS · Supabase (PostgreSQL, Storage, Realtime) — sans Supabase Auth.

## Installation

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez dans l’ordre :
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_seed.sql`
   - `supabase/migrations/003_storage.sql`
   - `supabase/migrations/004_realtime.sql`
3. Vérifiez que Realtime est activé pour `vehicles`, `notifications`, `mechanic_assignments`.

### 2. Application

```bash
cp .env.example .env.local
# Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Déploiement Netlify

1. Connectez le dépôt GitHub à Netlify.
2. Build command : `npm run build` (déjà dans `netlify.toml`).
3. Ajoutez les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Déployez. Le plugin `@netlify/plugin-nextjs` gère le runtime Next.js automatiquement.

> Ne lancez pas `npm run build` pendant que `npm run dev` tourne en local (risque de corruption du cache `.next`).

## Comptes démo

| Identifiant | Mot de passe | Rôle |
|-------------|--------------|------|
| secretary | 1234 | Secrétaire |
| manager | 1234 | Chef d’atelier |
| mechanic1 | 1234 | Mécanicien 1 |
| mechanic2 | 1234 | Mécanicien 2 |
| mechanic3 | 1234 | Mécanicien 3 |
| storekeeper | 1234 | Magasinier |
| bodyworker | 1234 | Carrossier |
| seller | 1234 | Vendeur |
| admin | 1234 | Admin |

## Parcours workflow

1. **Secrétaire** — `/vehicles/arrivals` : création fiche véhicule, option VEI → alerte chef d’atelier.
2. **Chef d’atelier** — Réception (`/workshop/reception`), photos (min. 4), VEI, envoi atelier.
3. **Dispatch** — `/workshop/assign` : assignation mécanicien 1/2/3.
4. **Mécanicien** — `/vehicles/my` → diagnostic (signature, devis, photos).
5. **Magasinier** — `/parts` : stock, commandes, notification pièces reçues.
6. **Chef d’atelier** — `/workshop/validation` : réparer / remplacer.
7. **Mécanicien** — réparation `/vehicles/repair/[id]`.
8. **Carrossier** — `/bodywork` si assigné.
9. **Validation finale** — `/workshop/final` → statut « Prêt à vendre » → vendeur.
10. **Vendeur** — `/vehicles/ready-sale` : lavage, photos, mise en vente / réservé / vendu.

## Structure

```
app/
  login/
  dashboard/
  vehicles/     arrivals, my, diagnostic, repair, ready-sale, [id]
  workshop/     reception, vei, assign, validation, final
  parts/
  bodywork/
  users/
components/
lib/            supabase.ts, auth.ts, db.ts, constants.ts
middleware.ts
supabase/migrations/
```

## Sécurité

Authentification par table `users` et cookie de session (`garage_session`). Les mots de passe démo sont en clair — **à hasher en production** et restreindre les politiques RLS / réseau.

## Licence

Usage interne atelier.
