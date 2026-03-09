// services/allocationService.ts
// CRUD para task_member_allocations via Backend API
import { TaskMemberAllocation } from '@/types';
import { apiRequest } from './apiClient';

const toFrontend = (row: any): TaskMemberAllocation => ({
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    reservedHours: Number(row.reserved_hours),
});

export async function fetchAllAllocations(): Promise<TaskMemberAllocation[]> {
    const data = await apiRequest<any[]>('/allocations');
    return (data || []).map(toFrontend);
}

export async function fetchAllocationsForTask(taskId: string): Promise<TaskMemberAllocation[]> {
    const data = await apiRequest<any[]>(`/allocations?taskId=${taskId}`);
    return (data || []).map(toFrontend);
}

export async function upsertAllocation(
    taskId: string,
    userId: string,
    reservedHours: number
): Promise<TaskMemberAllocation | null> {
    const result = await apiRequest<any>('/allocations', {
        method: 'POST',
        body: JSON.stringify({
            task_id: Number(taskId),
            user_id: Number(userId),
            reserved_hours: reservedHours,
        })
    });

    if (!result || result.message === 'Allocation removed') return null;
    return toFrontend(result);
}

export async function deleteAllocationsForTask(taskId: string): Promise<void> {
    await apiRequest(`/allocations/task/${taskId}`, {
        method: 'DELETE'
    });
}

export async function saveTaskAllocations(
    taskId: string,
    allocations: { userId: string; reservedHours: number }[]
): Promise<void> {
    // 1. Limpa as alocações atuais da tarefa
    await deleteAllocationsForTask(taskId);

    // 2. Insere as novas alocações uma a uma
    const validAllocations = allocations.filter(a => a.reservedHours > 0);
    const promises = validAllocations.map(a => upsertAllocation(taskId, a.userId, a.reservedHours));

    await Promise.all(promises);
}
