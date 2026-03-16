import { z } from 'zod';

export const createClientSchema = z.object({
    NomeCliente: z.string().min(2, "Nome do cliente deve ter ao menos 2 caracteres"),
    "E-mail": z.string().optional().nullable().transform(() => undefined),
    email: z.string().email("E-mail privado inválido").or(z.literal("")).optional().nullable(),
    ativo: z.boolean().optional(),
    Responsavel: z.string().optional().nullable(),
    Telefone: z.string().optional().nullable(),
    NewLogo: z.string().optional().nullable(),
    Pais: z.string().optional().nullable(),
    tipo_cliente: z.enum(['cliente_final', 'parceiro']).optional().nullable(),
    partner_id: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]).optional().nullable(),
    responsavel_interno_id: z.union([z.number(), z.string()]).optional().nullable(),
    responsavel_externo: z.string().optional().nullable(),
    email_contato: z.string().email("E-mail de contato inválido").or(z.literal("")).optional().nullable(),
    cnpj: z.string().optional().nullable(),
    Criado: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
}).passthrough();

export const updateClientSchema = createClientSchema.partial();
