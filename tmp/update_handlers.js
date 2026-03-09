const fs = require('fs');
const file = 'c:/Users/login/OneDrive/Área de Trabalho/Projetos/sistema-de-gest-o/frontend/src/components/OrganizationalStructureSelector.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
    /const handleCargoChange = \(newCargo: string\) => \{[^}]+setTorre\(''\);\r?\n\s+\};/,
    `const handleCargoChange = (newCargo: string) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
        onChange({ cargo: newCargo, nivel: '', torre: '' });
    };`
);

txt = txt.replace(
    /const handleLevelChange = \(newLevel: string\) => \{[^}]+setTorre\(''\);\r?\n\s+\};/,
    `const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
        onChange({ cargo, nivel: newLevel, torre: '' });
    };`
);

fs.writeFileSync(file, txt);
console.log("Functions updated successfully");
