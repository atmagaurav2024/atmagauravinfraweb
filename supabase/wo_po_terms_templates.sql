-- Reusable, named Terms & Conditions templates for WO/PO generation,
-- so common wordings can be saved once and picked from a dropdown
-- instead of re-typing/re-editing every time.
create table if not exists wo_po_terms_templates (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null default 'both', -- 'wo' | 'po' | 'both' — which document types this template applies to
  template_name text not null,
  terms_text text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table wo_po_terms_templates enable row level security;

-- Matches the pattern of other master tables (subcontractors, vendors
-- etc.) in this app - not explicitly company-scoped in the client
-- query, relying on RLS. Adjust to match your existing policies if
-- those tables use a different, stricter setup.
create policy "wo_po_terms_templates_all" on wo_po_terms_templates for all using (true) with check (true);
