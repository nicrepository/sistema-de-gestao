const fs = require('fs');
const path = 'c:\\Users\\login\\OneDrive\\Área de Trabalho\\Projetos\\sistema-de-gest-o\\frontend\\src\\components\\TeamMemberDetail.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remover item "Reserva" da legenda
const reservationLegend = /<div className="flex items-center gap-1\.5" title="Horas de reserva técnica ou suporte">[\s\S]*?<\/div>/;
content = content.replace(reservationLegend, '');

// 2. Simplificar cálculo de total no loop de renderização (remover .continuousHours)
content = content.replace(/const total = day\.plannedHours \+ day\.continuousHours;/g, 'const total = day.plannedHours;');

// 3. Remover a barra de "Reserva" do Heatmap
const reservationBar = /<div className="flex-1 bg-amber-400\/80" style={{ height: `\${\(day\.continuousHours \/ Math\.max\(1, day\.capacity\)\) \* 100}%`, flex: 'none' }} \/>/g;
content = content.replace(reservationBar, '');

// 4. Remover "RESERVA" do Tooltip
const reservationTooltip = /<div className="flex justify-between items-center text-\[8px\] font-bold">\s*<span className="text-amber-400">RESERVA:<\/span>[\s\S]*?<\/div>/g;
content = content.replace(reservationTooltip, '');

// 5. Ajustar CARGA TOTAL se necessário (já deve estar certo pelo total = plannedHours)

fs.writeFileSync(path, content, 'utf8');
console.log("TeamMemberDetail.tsx simplified: 'Reserva/Contínuo' removed from UI.");
