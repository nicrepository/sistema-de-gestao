-- database/SQL_SETUP_THEME.sql

-- Tabela de Organizações (Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    theme_primary TEXT,
    theme_secondary TEXT,
    theme_accent TEXT,
    theme_overrides JSONB,
    theme_mode TEXT DEFAULT 'dark', -- 'dark' | 'light'
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar organization_id aos colaboradores para suportar multi-tenancy
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dim_colaboradores' AND column_name='organization_id') THEN
        ALTER TABLE public.dim_colaboradores ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;
END $$;

-- Criar a organização padrão (Nic-Labs) se não existir para migração inicial
INSERT INTO public.organizations (name, slug, theme_primary, theme_secondary, theme_accent)
VALUES ('Nic-Labs', 'nic-labs', '#1e293b', '#334155', '#6366f1')
ON CONFLICT (slug) DO NOTHING;

-- Vincular todos os colaboradores atuais à organização padrão
-- Isso garante que as funcionalidades existentes não quebrem
UPDATE public.dim_colaboradores 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'nic-labs')
WHERE organization_id IS NULL;
