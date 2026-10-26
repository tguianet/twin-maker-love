create table if not exists public.cash_sessions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 opened_by uuid not null references auth.users(id),
 opened_at timestamptz not null default now(),
 opening_balance numeric(12,2) not null default 0 check (opening_balance>=0),
 opening_note text,
 closed_at timestamptz,
 closed_by uuid references auth.users(id),
 closing_note text,
 check (closed_at is null or closed_at>=opened_at)
);
create unique index if not exists cash_one_open_session on public.cash_sessions(organization_id) where closed_at is null;
create table if not exists public.cash_movements (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.cash_sessions(id),
 organization_id uuid not null references public.organizations(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 description text not null check (length(trim(description))>0),
 direction text not null check(direction in ('in','out')),
 method text not null check(method in ('cash','pix','debit','credit','other')),
 amount numeric(12,2) not null check(amount>0)
);
create index if not exists cash_movements_session_idx on public.cash_movements(session_id,created_at);
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
create policy cash_sessions_member_read on public.cash_sessions for select to authenticated using (public.is_org_member(organization_id));
create policy cash_sessions_staff_insert on public.cash_sessions for insert to authenticated with check (opened_by=auth.uid() and public.can_manage_org(organization_id));
create policy cash_sessions_staff_close on public.cash_sessions for update to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy cash_movements_member_read on public.cash_movements for select to authenticated using (public.is_org_member(organization_id));
create policy cash_movements_staff_insert on public.cash_movements for insert to authenticated with check (
 created_by=auth.uid() and public.can_manage_org(organization_id) and
 exists(select 1 from public.cash_sessions s where s.id=session_id and s.organization_id=cash_movements.organization_id and s.closed_at is null)
);
revoke update,delete on public.cash_movements from anon,authenticated;
create or replace function public.guard_cash_session_update() returns trigger language plpgsql set search_path='' as $$
begin
 if old.closed_at is not null then raise exception 'Closed cash session cannot be modified'; end if;
 if new.id<>old.id or new.organization_id<>old.organization_id or new.opened_by<>old.opened_by or new.opening_balance<>old.opening_balance or new.opened_at<>old.opened_at then
   raise exception 'Opening records are immutable';
 end if;
 if new.closed_at is not null then
   if new.closed_by is distinct from auth.uid() then raise exception 'Closing user mismatch'; end if;
 else
   if new.closed_by is not null then raise exception 'Invalid close state'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_cash_session_update on public.cash_sessions;
create trigger guard_cash_session_update before update on public.cash_sessions for each row execute function public.guard_cash_session_update();
