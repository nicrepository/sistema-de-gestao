const fs = require('fs');
const path = 'c:\\Users\\login\\OneDrive\\Área de Trabalho\\Projetos\\sistema-de-gest-o\\frontend\\src\\components\\TeamMemberDetail.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Atualizar Legenda para (Ocupado, Reserva, Ausência, Livre)
// Removendo as antigas e inserindo as novas com os termos pedidos
const legendSearch = /<div className="flex items-center gap-4">[\s\S]*?<\/div>\s*<\/div>/;
const newLegend = `<div className="flex flex-wrap items-center gap-4">
                                     <div className="flex items-center gap-1.5" title="Horas ocupadas com projetos ativos">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                                        <span className="text-[9px] font-black uppercase text-[var(--muted)]">Ocupado</span>
                                     </div>
                                     <div className="flex items-center gap-1.5" title="Horas de reserva técnica ou atividades internas">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]"></div>
                                        <span className="text-[9px] font-black uppercase text-[var(--muted)]">Reserva</span>
                                     </div>
                                     <div className="flex items-center gap-1.5" title="Dias de ausência (Férias, Atestado, etc)">
                                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"></div>
                                        <span className="text-[9px] font-black uppercase text-[var(--muted)]">Ausência</span>
                                     </div>
                                     <div className="flex items-center gap-1.5" title="Horas totalmente livres para alocação">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]"></div>
                                        <span className="text-[9px] font-black uppercase text-[var(--muted)]">Livre</span>
                                     </div>
                                  </div>`;

content = content.replace(legendSearch, (match) => {
    // We want to replace only the inner part of the gap-4 div if possible, 
    // but replacing the whole legend block is safer since we are adding an item.
    if (match.includes('Projetos Ativos') || match.includes('Planejado')) {
        return newLegend + '</div>';
    }
    return match;
});

// 2. Atualizar Tooltip para bater com a legenda
content = content.replace(/<span className="text-blue-400">PROJETOS:<\/span>/g, '<span className="text-blue-400">OCUPADO:</span>');
content = content.replace(/<span className="text-amber-400">CONTÍNUO:<\/span>/g, '<span className="text-amber-400">RESERVA:</span>');
content = content.replace(/<span className="text-emerald-400">DISPONÍVEL:<\/span>/g, '<span className="text-emerald-400">LIVRE:</span>');

fs.writeFileSync(path, content, 'utf8');
console.log("TeamMemberDetail.tsx legend updated to Ocupado, Reserva, Ausência, Livre");
