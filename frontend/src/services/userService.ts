// services/userService.ts
import { User } from '@/types';
import { apiRequest } from './apiClient';

const safeNum = (val: any) => {
    if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
};

export async function createUser(userData: Partial<User>): Promise<string> {
    const payload = {
        NomeColaborador: userData.name,
        email: userData.email,
        Cargo: userData.cargo,
        nivel: userData.nivel,
        role: userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Resource',
        ativo: userData.active ?? true,
        custo_hora: userData.hourlyCost,
        horas_disponiveis_dia: userData.dailyAvailableHours,
        horas_disponiveis_mes: userData.monthlyAvailableHours,
        torre: userData.torre
    };

    const result = await apiRequest<any>('/colaboradores', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    return String(result.ID_Colaborador);
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const payload: any = {};
    if (updates.name !== undefined) payload.NomeColaborador = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.cargo !== undefined) payload.Cargo = updates.cargo;
    if (updates.nivel !== undefined) payload.nivel = updates.nivel;
    if (updates.role !== undefined) payload.role = updates.role.charAt(0).toUpperCase() + updates.role.slice(1);
    if (updates.active !== undefined) payload.ativo = updates.active;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.hourlyCost !== undefined) payload.hourlyCost = updates.hourlyCost;
    if (updates.dailyAvailableHours !== undefined) payload.dailyAvailableHours = updates.dailyAvailableHours;
    if (updates.monthlyAvailableHours !== undefined) payload.monthlyAvailableHours = updates.monthlyAvailableHours;
    if (updates.torre !== undefined) payload.torre = updates.torre;
    if (updates.atrasado !== undefined) payload.atrasado = updates.atrasado;

    await apiRequest(`/colaboradores/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
}

export async function deleteUser(userId: string): Promise<void> {
    await apiRequest(`/colaboradores/${userId}`, {
        method: 'DELETE'
    });
}
