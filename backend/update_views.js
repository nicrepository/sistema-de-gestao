import { supabaseAdmin } from './src/config/supabaseAdmin.js';
import { logger } from './src/utils/logger.js';

/**
 * Atualiza todas as views do banco de dados para garantir consistência entre
 * os novos nomes (snake_case e camelCase p/ frontend) e os nomes antigos (p/ compatibilidade).
 */
async function updateViews() {
    try {
        logger.info('Iniciando atualização de views do Supabase...', 'Migration');

        const sqlQueries = [
            `
            -- V_COLABORADORES
            CREATE OR REPLACE VIEW v_colaboradores AS 
            SELECT 
                id_colaborador AS id, 
                id_colaborador AS "ID_Colaborador",
                nome_colaborador AS nome, 
                nome_colaborador AS "NomeColaborador",
                cargo, 
                cargo AS "Cargo",
                nivel, torre, role, email, 
                avatar_url AS "avatarUrl", 
                avatar_url AS "avatar_url", 
                ativo, auth_user_id 
            FROM dim_colaboradores 
            WHERE deleted_at IS NULL;
            `,
            `
            -- V_CLIENTES
            CREATE OR REPLACE VIEW v_clientes AS 
            SELECT 
                "ID_Cliente" AS id, 
                "ID_Cliente",
                "NomeCliente" AS nome, 
                "NomeCliente" AS "NomeCliente",
                ativo, 
                "Pais" AS pais, 
                "NewLogo" AS "logoUrl",
                "NewLogo" AS "new_logo",
                contato_principal,
                tipo_cliente,
                partner_id,
                doc_nic_ativo,
                cnpj,
                email_contato,
                telefone,
                responsavel_interno_id,
                responsavel_externo,
                razao_social,
                segmento,
                email_financeiro,
                responsavel_tecnico,
                data_inicio_contrato,
                data_fim_contrato,
                endereco_rua,
                endereco_numero,
                endereco_complemento,
                endereco_bairro,
                endereco_cidade,
                endereco_estado,
                endereco_cep,
                contato_celular,
                contato_whatsapp,
                contato_cargo
            FROM dim_clientes 
            WHERE deleted_at IS NULL;
            `,
            `
            -- V_PROJETOS
            CREATE OR REPLACE VIEW v_projetos AS 
            SELECT 
                "ID_Projeto" AS id, 
                "ID_Projeto",
                "NomeProjeto" AS nome, 
                "NomeProjeto",
                "ID_Cliente" AS cliente_id, 
                "ID_Cliente",
                "StatusProjeto" AS status, 
                "StatusProjeto",
                torre, 
                complexidade, 
                manager, 
                "startDate", 
                "startDate" AS start_date,
                "estimatedDelivery", 
                "estimatedDelivery" AS estimated_delivery,
                valor_total_rs, 
                ativo, 
                partner_id, 
                horas_vendidas,
                description,
                manager_client,
                responsible_nic_labs_id,
                start_date_real,
                end_date_real,
                doc_link,
                gaps_issues,
                important_considerations,
                weekly_status_report,
                valor_diario,
                project_type,
                project_manager_id,
                budget,
                critical_date,
                responsible_user_id,
                risks,
                success_factor
            FROM dim_projetos 
            WHERE deleted_at IS NULL;
            `,
            `
            -- V_TAREFAS
            CREATE OR REPLACE VIEW v_tarefas AS 
            SELECT 
                id_tarefa_novo AS id, 
                id_tarefa_novo AS "ID_Tarefa_Novo",
                "ID_Projeto" AS projeto_id, 
                "ID_Cliente" AS cliente_id, 
                "ID_Colaborador" AS colaborador_id, 
                "StatusTarefa" AS status, 
                "Prioridade" AS prioridade, 
                "Impacto" AS impacto, 
                "Afazer" AS tarefa, 
                "Porcentagem" AS progress, 
                description, 
                entrega_estimada, 
                entrega_real, 
                inicio_previsto, 
                inicio_real, 
                em_testes, 
                dias_atraso, 
                estimated_hours, 
                allocated_hours, 
                is_impediment
            FROM fato_tarefas 
            WHERE deleted_at IS NULL;
            `
        ];

        // Usando a ferramenta remota p/ aplicar a migração SQL
        // Como o script está rodando localmente, usaremos rpc exec_sql se disponível
        // ou precisaremos invocar a migração via MCP se o script for rodado pelo agente.
        // Vou imprimir o SQL para rodar via MCP.

        console.log("SQL para ser rodado via MCP Supabase:");
        console.log(sqlQueries.join('\n\n'));

    } catch (err) {
        logger.error(`Erro ao atualizar views: ${err.message}`, 'Migration', err);
    }
}

updateViews();
