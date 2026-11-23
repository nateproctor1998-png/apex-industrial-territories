# Apex Territory Map — optional secure cloud synchronization

The public GitHub Pages website is a static application. **GitHub does not store the private sales records.** This integration remains offline until you configure your own Supabase project and sign in.

## 1. Configure Supabase

Create a Supabase project at https://supabase.com/. In the SQL editor, run:

```sql
create table if not exists public.apex_maps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.apex_maps enable row level security;

revoke all on table public.apex_maps from anon;
grant select, insert, update, delete on table public.apex_maps to authenticated;

create policy "apex_select_own" on public.apex_maps
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "apex_insert_own" on public.apex_maps
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "apex_update_own" on public.apex_maps
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "apex_delete_own" on public.apex_maps
  for delete to authenticated using ((select auth.uid()) = user_id);
```

If a policy already exists, edit it instead of re-running its CREATE statement.

## 2. Configure email sign-in

Under Authentication > URL Configuration, set the site URL to:

https://nateproctor1998-png.github.io/apex-industrial-territories/

Add that address to the Redirect URLs allowlist. Enable email OTP / magic link. Configure production email delivery as appropriate.

In the map's Cloud Sync panel, enter the Supabase HTTPS project URL and **public publishable (or legacy anon) key**. These are client-side connection parameters. **Never enter a secret / service_role key** or put one in GitHub. Sign in through the magic link sent to your email.

## 3. First upload and subsequent synchronization

1. Export an offline JSON backup before the first upload.
2. Click Upload to cloud to store your locally edited contacts, activities, facility-size estimates, verified coordinates, route stops, and discovery inbox.
3. On a second device, connect the same Supabase project, sign in with the same account, and click Download from cloud.
4. Upload is manual. It warns when the cloud copy changed since the last known cloud version. Pull replaces local edits **only after confirmation** and creates a local restore backup.

This is intentionally **not an automatic background merge**. Two people modifying the same facility independently must reconcile changes before uploading. A small timestamp check is not a transactional conflict lock.

## Important limitations

- If the user has not configured Supabase, all existing data remains in browser localStorage, exactly as before. Cloud sync is NOT active by default.
- This site is public. Supabase Row Level Security is mandatory. Keep all service-role and secret keys out of client-side code. Authenticated users may only access their own row under the policies above.
- The discovery inbox accepts **user-imported** CSV/JSON reports; it does not scrape websites or run scheduled searches by itself. The user's existing daily prospect discovery automation remains a separate system.
- Facility square footage and GPS coordinates are not auto-filled or independently verified. Enter a size with a source citation. Verify each coordinate manually against OpenStreetMap or official map data.
- Route optimization uses coordinates from verified stops and shortest **straight-line distance**, not a road network or driving-time optimization. Google Maps then provides driving directions.
- Browser desktop notifications for due follow-ups work only while the map is open and the browser permits notifications.
