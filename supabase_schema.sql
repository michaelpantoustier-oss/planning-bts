-- ── Table planning_responses ─────────────────────────────────────
create table if not exists planning_responses (
  id            bigserial primary key,
  submitted_at  timestamptz not null default now(),

  -- Identité
  nom           text not null,
  prenom        text not null,
  email         text not null,

  -- Filières & matières (arrays JSON)
  filieres      text[]  not null default '{}',
  matieres      text[]  not null default '{}',

  -- Volume & campus
  heures_hebdo  int     not null default 18,
  campus        text[]  not null default '{}',

  -- Disponibilités : {"lun":{"matin":"dispo","apm":"demi"}, ...}
  dispo         jsonb   not null default '{}',

  -- Classes & objectifs : [{"nom":"BTS BM 1","taux":80,"moy":12}, ...]
  classes       jsonb   not null default '[]',

  -- Remarques libres
  remarques     text    not null default ''
);

-- ── Row-Level Security ────────────────────────────────────────────
alter table planning_responses enable row level security;

-- Tout le monde (anon) peut insérer (soumettre le formulaire)
create policy "anon insert"
  on planning_responses for insert
  to anon
  with check (true);

-- Seul le service_role (admin back-end) peut lire et supprimer
-- Pour un accès admin depuis le front, utilise la service_role key
-- dans un edge function, ou désactive temporairement RLS pour les tests.
create policy "service read"
  on planning_responses for select
  to service_role
  using (true);

create policy "service delete"
  on planning_responses for delete
  to service_role
  using (true);

-- ── Index ─────────────────────────────────────────────────────────
create index on planning_responses (submitted_at desc);
create index on planning_responses using gin (filieres);
