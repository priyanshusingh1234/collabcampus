# Project backups

This repo includes a simple backup process that creates a ZIP of your workspace, excluding heavy/generated folders and sensitive env files.

What the backup includes
- All source files and assets
- Prisma schema and migrations (if any)
- Docs and configuration

What the backup excludes
- node_modules/
- .next/
- .git/
- backups/ (to avoid recursive nesting)
- .env and .env.local (so secrets aren’t leaked)

How to create a backup (Windows/PowerShell)
1. Ensure you’re at the workspace root.
2. Run the npm script:

```powershell
npm run backup
```

This will create: `backups/site-backup-YYYYMMDD-HHmmss.zip`

Manual restore
- Unzip the backup to your desired location.
- Recreate `.env.local` manually from your records (secrets aren’t in the ZIP).
- Install dependencies and start dev:

```powershell
npm install
npm run dev
```

PostgreSQL data (optional)
- If you are using Postgres, back up data separately:

```powershell
# Dump the DB (replace DBNAME and credentials)
pg_dump -h localhost -U postgres -d DBNAME -F c -f backups/db-backup-YYYYMMDD-HHmmss.dump

# Restore later
pg_restore -h localhost -U postgres -d DBNAME -c backups/db-backup-YYYYMMDD-HHmmss.dump
```

Git snapshot (optional)
- You can also create a quick Git tag as an anchor point:

```powershell
git add -A
git commit -m "backup snapshot" --allow-empty
git tag -f backup-latest
```