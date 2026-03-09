import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    CloudUpload,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Info,
    Table,
    Download
} from 'lucide-react';
import { syncExcel, exportDatabaseExcel } from '@/services/reportApi';
import { ToastContainer, ToastType } from '@/components/Toast';

const AdminSync: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Redirecionamento de segurança (cargo Manutenção apenas)
    useEffect(() => {
        if (currentUser && currentUser.cargo?.toLowerCase() !== 'manutenção') {
            navigate('/dashboard');
        }
    }, [currentUser, navigate]);

    const [file, setFile] = useState<File | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado local para toasts já que o componente exige o array
    const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

    const addToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                setResults(null);
            } else {
                addToast("Por favor, selecione um arquivo Excel (.xlsx)", 'error');
            }
        }
    };

    const handleSync = async () => {
        if (!file) return;

        setIsSyncing(true);
        setResults(null);
        setProgress(10);

        try {
            setProgress(30);
            const response = await syncExcel(file);
            setProgress(100);
            setResults(response.details);
            addToast("Sincronização concluída com sucesso!", 'success');
        } catch (error: any) {
            console.error("Erro na sincronização:", error);
            addToast(`Falha na sincronização: ${error.message}`, 'error');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleExport = async () => {
        try {
            addToast("Gerando planilha de backup...", 'success');
            const { blob, filename } = await exportDatabaseExcel();

            // Criar link para download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `backup_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addToast("Backup baixado com sucesso!", 'success');
        } catch (error: any) {
            console.error("Erro ao exportar banco de dados:", error);
            addToast(`Falha ao gerar backup: ${error.message}`, 'error');
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text)' }}>
                        <RefreshCw className="w-8 h-8 text-indigo-500" />
                        Sincronização de Planilha
                    </h1>
                    <p className="mt-2 text-sm max-w-2xl font-medium" style={{ color: 'var(--muted)' }}>
                        Atualize os dados do sistema em massa subindo a planilha mestre consolidada.
                        O sistema atualizará registros existentes e inserirá novos automaticamente baseando-se nos IDs.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* CARD DE DOWNLOAD DO BACKUP */}
                    <div className="border-2 rounded-3xl p-8 transition-all" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-4 rounded-2xl bg-emerald-500 text-white">
                                    <Download className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
                                        Baixar Backup Completo
                                    </h3>
                                    <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                                        Exporta todos os dados do sistema em uma planilha Excel que pode ser reimportada
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleExport}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                            >
                                <Download className="w-5 h-5" />
                                Gerar Backup
                            </button>
                        </div>
                        <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)', borderLeft: '4px solid var(--primary)' }}>
                            <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                                📋 Esta planilha contém todas as tabelas:
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                                dim_clientes, dim_colaboradores, dim_projetos, fato_tarefas, horas_trabalhadas
                            </p>
                        </div>
                    </div>

                    {/* SEPARADOR */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>ou</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                    </div>

                    {/* CARD DE UPLOAD */}
                    <div
                        onClick={triggerFileInput}
                        className={`
                            relative border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer
                            flex flex-col items-center justify-center gap-4
                            ${file
                                ? 'border-indigo-500 bg-indigo-50/30'
                                : 'border-slate-300 hover:border-indigo-400'}
                        `}
                        style={{ backgroundColor: file ? 'var(--surface-2)' : 'var(--surface)', borderColor: !file ? 'var(--border)' : undefined }}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".xlsx"
                            className="hidden"
                        />

                        <div className={`p-4 rounded-2xl ${file ? 'bg-indigo-500 text-white' : 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>
                            {file ? <Table className="w-12 h-12" /> : <CloudUpload className="w-12 h-12" />}
                        </div>

                        <div className="text-center">
                            {file ? (
                                <span className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                                    {file.name}
                                </span>
                            ) : (
                                <>
                                    <p className="font-semibold text-lg underline decoration-indigo-500 underline-offset-4" style={{ color: 'var(--text)' }}>
                                        Clique para selecionar a planilha
                                    </p>
                                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Formato suportado: Microsoft Excel (.xlsx)</p>
                                </>
                            )}
                        </div>
                    </div>

                    {file && (
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setFile(null)}
                                className="px-6 py-3 rounded-2xl font-medium hover:bg-black/5 transition-colors"
                                style={{ color: 'var(--muted)' }}
                                disabled={isSyncing}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`
                                    px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2
                                    ${isSyncing
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'}
                                `}
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Sincronizando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-5 h-5" />
                                        Iniciar Sincronização
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {progress > 0 && (
                        <div className="rounded-3xl p-6 border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Progresso da Operação</span>
                                <span className="text-sm font-bold text-indigo-500">{progress}%</span>
                            </div>
                            <div className="h-3 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {results && (
                        <div className="border rounded-3xl p-8 space-y-6" style={{ backgroundColor: 'var(--success-bg)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3" style={{ color: 'var(--success)' }}>
                                <CheckCircle2 className="w-7 h-7" />
                                <h3 className="text-xl font-bold">Relatório de Importação</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                {Object.entries(results).map(([table, count]) => (
                                    <div key={table} className="p-4 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                                            {table.replace('dim_', '').replace('fato_', '')}
                                        </p>
                                        <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                                            {count as number}
                                        </p>
                                        <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>unidades</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="text-white rounded-3xl p-8 shadow-xl" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Info className="w-5 h-5 text-indigo-400" />
                            Regras de Negócio
                        </h3>
                        <ul className="space-y-4 text-sm opacity-80">
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                <span><b>Nomes Iguais:</b> As abas (ex: dim_clientes) e colunas devem ter exatamente os mesmos nomes do Supabase.</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                <span><b>Sobrescrever:</b> O sistema reescreverá os valores se encontrar um ID correspondente (Upsert).</span>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                <span><b>Colaboradores:</b> Sincroniza dados baseando-se no ID ou e-mail.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="border rounded-3xl p-8" style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'var(--border)' }}>
                        <h3 className="font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--warning-text)' }}>
                            <AlertTriangle className="w-5 h-5" />
                            Atenção
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--warning-text)' }}>
                            Certifique-se de que a planilha mestre está correta. Dados incorretos podem afetar os relatórios financeiros.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSync;
