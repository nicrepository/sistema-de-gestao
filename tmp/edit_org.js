const fs = require('fs');

const file = 'frontend/src/components/OrganizationalStructureSelector.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
    `    const handleCargoChange = (newCargo: string) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
    };`,
    `    const handleCargoChange = (newCargo: string) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
        onChange({ cargo: newCargo, nivel: '', torre: '' });
    };`
);

text = text.replace(
    `    const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
    };`,
    `    const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
        onChange({ cargo, nivel: newLevel, torre: '' });
    };`
);

text = text.replace(`onChange={(e) => setCargo(e.target.value)}`, `onChange={(e) => { setCargo(e.target.value); onChange({ cargo: e.target.value, nivel, torre }); }}`);
text = text.replace(`onChange={(e) => setNivel(e.target.value)}`, `onChange={(e) => { setNivel(e.target.value); onChange({ cargo, nivel: e.target.value, torre }); }}`);
text = text.replace(`onChange={(e) => setTorre(e.target.value)}`, `onChange={(e) => { setTorre(e.target.value); onChange({ cargo, nivel, torre: e.target.value }); }}`);
text = text.replace(`onClick={() => setTorre(\`\${t.name}: \${spec.name}\`)}`, `onClick={() => { const newTorre = \`\${t.name}: \${spec.name}\`; setTorre(newTorre); onChange({ cargo, nivel, torre: newTorre }); }}`);
text = text.replace(`onClick={() => setTorre('N/A')}`, `onClick={() => { setTorre('N/A'); onChange({ cargo, nivel, torre: 'N/A' }); }}`);
text = text.replace(`onClick={() => setCargo('')}`, `onClick={() => { setCargo(''); setNivel(''); setTorre(''); onChange({ cargo: '', nivel: '', torre: '' }); }}`);
text = text.replace(`onClick={() => cargo && setNivel('')}`, `onClick={() => { if(cargo){ setNivel(''); setTorre(''); onChange({ cargo, nivel: '', torre: '' }); } }}`);
text = text.replace(`onClick={() => nivel && setTorre('')}`, `onClick={() => { if(nivel){ setTorre(''); onChange({ cargo, nivel, torre: '' }); } }}`);

fs.writeFileSync(file, text);
console.log("Edits applied via node");
