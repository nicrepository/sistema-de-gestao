-- ============================================================
-- MIGRATION: Corrigir filtro de soft-delete no relatório
-- Problema: relatorio_horas_custos não filtra deleted_at IS NULL,
--           fazendo apontamentos excluídos aparecerem no relatório.
-- Correção: adicionado ht.deleted_at IS NULL no WHERE do CTE filtered_hours
-- ============================================================

CREATE OR REPLACE FUNCTION public.relatorio_horas_custos(
    p_data_ini date DEFAULT NULL::date,
    p_data_fim date DEFAULT NULL::date,
    p_clientes bigint[] DEFAULT NULL::bigint[],
    p_projetos bigint[] DEFAULT NULL::bigint[],
    p_colaboradores bigint[] DEFAULT NULL::bigint[],
    p_status text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
    id_cliente integer,
    cliente text,
    id_projeto integer,
    projeto text,
    id_colaborador integer,
    colaborador text,
    data_registro date,
    tarefa text,
    status_tarefa text,
    horas numeric,
    valor_projeto numeric,
    horas_projeto_total numeric,
    valor_hora_projeto numeric,
    valor_rateado numeric,
    data_inicio_p date,
    data_fim_p date,
    status_p text,
    complexidade_p text,
    progresso_p numeric,
    parceiro text,
    responsavel text,
    inicio_real date,
    fim_real date,
    horas_vendidas numeric,
    valor_total_rs numeric,
    custo_hora_colab numeric
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_hours AS (
    SELECT
      ht."ID_Cliente",
      ht."ID_Projeto",
      ht."ID_Colaborador",
      CAST(ht."Data" AS date) as reg_date,
      SUM(COALESCE(CAST(ht."Horas_Trabalhadas" AS numeric), 0)) as horas_val,
      STRING_AGG(
        DISTINCT COALESCE(ft."Afazer", 'Sem Tarefa'),
        ' | '
        ORDER BY COALESCE(ft."Afazer", 'Sem Tarefa')
      ) as tarea_desc,
      MAX(COALESCE(ft."StatusTarefa", 'N/A')) as st_task
    FROM horas_trabalhadas ht
    LEFT JOIN fato_tarefas ft ON ht."id_tarefa_novo" = ft."id_tarefa_novo"
    WHERE ht.deleted_at IS NULL                                             -- FIX: ignora soft-deleted
      AND ht."Data" ~ '^\d{4}-\d{2}-\d{2}$'
      AND (p_data_ini IS NULL OR CAST(ht."Data" AS date) >= p_data_ini)
      AND (p_data_fim IS NULL OR CAST(ht."Data" AS date) <= p_data_fim)
      AND (p_clientes IS NULL OR ht."ID_Cliente" = ANY(p_clientes))
      AND (p_projetos IS NULL OR ht."ID_Projeto" = ANY(p_projetos))
      AND (p_colaboradores IS NULL OR ht."ID_Colaborador" = ANY(p_colaboradores))
      AND (p_status IS NULL OR COALESCE(ft."StatusTarefa", 'N/A') = ANY(p_status))
    GROUP BY
      ht."ID_Cliente",
      ht."ID_Projeto",
      ht."ID_Colaborador",
      CAST(ht."Data" AS date)
  ),
  project_totals AS (
    SELECT
      fh."ID_Projeto",
      SUM(fh.horas_val) as total_horas
    FROM filtered_hours fh
    GROUP BY fh."ID_Projeto"
  )
  SELECT
    CAST(c."ID_Cliente" AS integer),
    c."NomeCliente"::text,
    CAST(p."ID_Projeto" AS integer),
    p."NomeProjeto"::text,
    CAST(col.id_colaborador AS integer),
    col.nome_colaborador::text,
    fh.reg_date,
    COALESCE(fh.tarea_desc, '-')::text,
    COALESCE(fh.st_task, 'N/A')::text,
    fh.horas_val,
    COALESCE(p.budget, 0),
    COALESCE(pt.total_horas, 0),
    CASE
      WHEN COALESCE(pt.total_horas, 0) > 0 AND COALESCE(p.budget, 0) > 0
      THEN p.budget / pt.total_horas
      ELSE 0
    END,
    CASE
      WHEN COALESCE(pt.total_horas, 0) > 0 AND COALESCE(p.budget, 0) > 0
      THEN (fh.horas_val / pt.total_horas) * p.budget
      ELSE 0
    END,
    p."startDate",
    p."estimatedDelivery",
    COALESCE(p."StatusProjeto", 'Ativo'),
    COALESCE(p.complexidade, 'Média'),
    0::numeric,
    COALESCE(parc."NomeCliente", 'N/A')::text,
    COALESCE(resp.nome_colaborador, 'N/A')::text,
    p."start_date_real",
    p."end_date_real",
    COALESCE(p."horas_vendidas", 0),
    COALESCE(p."valor_total_rs", 0),
    COALESCE(col.custo_hora, 0)
  FROM filtered_hours fh
  JOIN dim_clientes c ON fh."ID_Cliente" = c."ID_Cliente"
  JOIN dim_projetos p ON fh."ID_Projeto" = p."ID_Projeto"
  JOIN dim_colaboradores col ON fh."ID_Colaborador" = col.id_colaborador
  LEFT JOIN project_totals pt ON fh."ID_Projeto" = pt."ID_Projeto"
  LEFT JOIN dim_clientes parc ON c.partner_id IS NOT NULL
    AND c.partner_id::text ~ '^\d+$'
    AND CAST(c.partner_id AS integer) = parc."ID_Cliente"
  LEFT JOIN dim_colaboradores resp ON p.responsible_nic_labs_id = resp.id_colaborador
  ORDER BY fh.reg_date DESC;
END;
$function$;

-- ============================================================
-- VERIFICAÇÃO: execute após aplicar a correção acima.
-- O resultado deve ser 0 (nenhum registro deletado no relatório).
-- ============================================================
SELECT COUNT(*)
FROM relatorio_horas_custos(NULL, NULL, NULL, NULL, NULL, NULL) r
JOIN horas_trabalhadas ht
  ON ht."ID_Horas_Trabalhadas"::text = r.id_colaborador::text
WHERE ht.deleted_at IS NOT NULL;
-- ============================================================
