# R3 STEP 2-3: UPDATE .env FILE HELPER

## Current .env status

**Backup created:** `.env.backup.r3` ✅

**Current DATABASE_URL:**
```
${DATABASE_ADMIN_URL}
```

**Connection details:**
- Host: `db.lvnvkpyxtuilhrabtlwv.supabase.co`
- Port: `5432`
- Database: `postgres`
- Current role: `postgres` (SUPERUSER - FULL MUTATION)

---

## STEP 2: Update DATABASE_URL to bella_developer

**Replace the DATABASE_URL line in `.env` with:**

```env
DATABASE_URL=postgresql://bella_developer:<PASSWORD_FROM_STEP_1>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

**Where:**
- `<PASSWORD_FROM_STEP_1>` = password you set for bella_developer in Step 1
- **URL-encode the password** if it contains special characters:
  - `@` → `%40`
  - `!` → `%21`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`
  - `&` → `%26`
  - `/` → `%2F`

**Example (replace with a secret-manager value):**
```env
DATABASE_URL="<DATABASE_URL from secret manager>"
```

---

## STEP 3: Add DATABASE_EXECUTOR_URL

**Add this NEW line to `.env`:**

```env
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<EXECUTOR_PASSWORD>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

**Where:**
- `<EXECUTOR_PASSWORD>` = password you set for bella_migration_executor in Step 1
- Remember to URL-encode special characters

---

## Final .env structure

After Steps 2 and 3, your `.env` should look like:

```env
DATABASE_URL=postgresql://bella_developer:<dev-password>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<exec-password>@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres
```

**DO NOT commit this file to git!** (Already in .gitignore)

---

## Verify Step 2-3 Complete

After updating `.env`, test the connections:

```bash
# Test developer connection (should show bella_developer)
node -e "import('pg').then(({default:pg})=>import('dotenv').then(({default:d})=>{d.config();const c=new pg.Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('SELECT current_user')).then(r=>{console.log('Developer role:',r.rows[0].current_user);c.end()})}))"

# Test executor connection (should show bella_migration_executor)
node -e "import('pg').then(({default:pg})=>import('dotenv').then(({default:d})=>{d.config();const c=new pg.Client({connectionString:process.env.DATABASE_EXECUTOR_URL});c.connect().then(()=>c.query('SELECT current_user')).then(r=>{console.log('Executor role:',r.rows[0].current_user);c.end()})}))"
```

**Expected output:**
```
Developer role: bella_developer
Executor role: bella_migration_executor
```

If both show correct roles → Steps 2-3 COMPLETE ✅

---

## Rollback (if needed)

If you need to revert:

```bash
# Restore original .env
Copy-Item .env.backup.r3 .env
```
