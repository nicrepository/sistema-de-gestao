// services/clientService.ts
// CRUD de Clientes via Backend Express

import { apiRequest } from './apiClient';
import { Client } from '@/types';

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
const safeNum = (val: any) => {
  if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
};

// ===========================
// CREATE
// ===========================
export async function createClient(data: Partial<Client>): Promise<number> {
  const now = new Date();

  const payload: Record<string, any> = {
    NomeCliente: data.name || "(Sem nome)",
    NewLogo: data.logoUrl,
    ativo: data.active !== undefined ? data.active : true,
    Criado: toDateStr(now),
    Pais: data.pais,
    cnpj: data.cnpj,
    telefone: data.telefone,
    tipo_cliente: data.tipo_cliente,
    partner_id: data.partner_id,
    responsavel_interno_id: data.responsavel_interno_id,
    responsavel_externo: data.responsavel_externo,
    email_contato: data.email_contato,
    doc_nic_ativo: data.doc_nic_ativo !== undefined ? data.doc_nic_ativo : false,
    
    // Novos campos
    razao_social: data.razao_social,
    segmento: data.segmento,
    email_financeiro: data.email_financeiro,
    responsavel_tecnico: data.responsavel_tecnico,
    data_inicio_contrato: data.data_inicio_contrato,
    data_fim_contrato: data.data_fim_contrato,
    endereco_rua: data.endereco_rua,
    endereco_numero: data.endereco_numero,
    endereco_complemento: data.endereco_complemento,
    endereco_bairro: data.endereco_bairro,
    endereco_cidade: data.endereco_cidade,
    endereco_estado: data.endereco_estado,
    endereco_cep: data.endereco_cep,
    contato_celular: data.contato_celular,
    contato_whatsapp: data.contato_whatsapp,
    contato_cargo: data.contato_cargo
  };

  const result = await apiRequest<any>('/clients', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result || !result.ID_Cliente) {
    throw new Error("Erro ao criar cliente: ID não retornado pelo servidor.");
  }

  return result.ID_Cliente;
}

// ===========================
// UPDATE
// ===========================
export async function updateClient(clientId: string, data: Partial<Client>): Promise<void> {
  const payload: Record<string, any> = {};

  if (data.name !== undefined) payload.NomeCliente = data.name;
  if (data.logoUrl !== undefined) payload.NewLogo = data.logoUrl;
  if (data.active !== undefined) payload.ativo = data.active;
  if (data.pais !== undefined) payload.Pais = data.pais;
  if (data.cnpj !== undefined) payload.cnpj = data.cnpj;
  if (data.telefone !== undefined) payload.telefone = data.telefone;
  if (data.tipo_cliente !== undefined) payload.tipo_cliente = data.tipo_cliente;
  if (data.partner_id !== undefined) payload.partner_id = data.partner_id;
  if (data.responsavel_interno_id !== undefined) payload.responsavel_interno_id = data.responsavel_interno_id;
  if (data.responsavel_externo !== undefined) payload.responsavel_externo = data.responsavel_externo;
  if (data.email_contato !== undefined) payload.email_contato = data.email_contato;
  if (data.doc_nic_ativo !== undefined) payload.doc_nic_ativo = data.doc_nic_ativo;

  // Novos campos
  if (data.razao_social !== undefined) payload.razao_social = data.razao_social;
  if (data.segmento !== undefined) payload.segmento = data.segmento;
  if (data.email_financeiro !== undefined) payload.email_financeiro = data.email_financeiro;
  if (data.responsavel_tecnico !== undefined) payload.responsavel_tecnico = data.responsavel_tecnico;
  if (data.data_inicio_contrato !== undefined) payload.data_inicio_contrato = data.data_inicio_contrato;
  if (data.data_fim_contrato !== undefined) payload.data_fim_contrato = data.data_fim_contrato;
  if (data.endereco_rua !== undefined) payload.endereco_rua = data.endereco_rua;
  if (data.endereco_numero !== undefined) payload.endereco_numero = data.endereco_numero;
  if (data.endereco_complemento !== undefined) payload.endereco_complemento = data.endereco_complemento;
  if (data.endereco_bairro !== undefined) payload.endereco_bairro = data.endereco_bairro;
  if (data.endereco_cidade !== undefined) payload.endereco_cidade = data.endereco_cidade;
  if (data.endereco_estado !== undefined) payload.endereco_estado = data.endereco_estado;
  if (data.endereco_cep !== undefined) payload.endereco_cep = data.endereco_cep;
  if (data.contato_celular !== undefined) payload.contato_celular = data.contato_celular;
  if (data.contato_whatsapp !== undefined) payload.contato_whatsapp = data.contato_whatsapp;
  if (data.contato_cargo !== undefined) payload.contato_cargo = data.contato_cargo;

  await apiRequest(`/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

// ===========================
// DELETE (Soft Delete - marca como removido do sistema)
// ===========================
export async function deleteClient(clientId: string): Promise<void> {
  await apiRequest(`/clients/${clientId}`, {
    method: 'DELETE'
  });
}

// ===========================
// DELETE (Hard Delete - remove do banco)
// ===========================
export async function hardDeleteClient(clientId: string): Promise<void> {
  await apiRequest(`/clients/${clientId}`, {
    method: 'DELETE'
  });
}

