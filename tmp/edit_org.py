import re

with open('frontend/src/components/OrganizationalStructureSelector.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleCargoChange
text = text.replace("""    const handleCargoChange = (newCargo: string) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
    };""", """    const handleCargoChange = (newCargo: string) => {
        setCargo(newCargo);
        setNivel('');
        setTorre('');
        onChange({ cargo: newCargo, nivel: '', torre: '' });
    };""")

# 2. Update handleLevelChange
text = text.replace("""    const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
    };""", """    const handleLevelChange = (newLevel: string) => {
        setNivel(newLevel);
        setTorre('');
        onChange({ cargo, nivel: newLevel, torre: '' });
    };""")

# 3. Add onChange for manual cargo input
text = text.replace("""onChange={(e) => setCargo(e.target.value)}""", """onChange={(e) => { setCargo(e.target.value); onChange({ cargo: e.target.value, nivel, torre }); }}""")

# 4. Add onChange for manual nivel input
text = text.replace("""onChange={(e) => setNivel(e.target.value)}""", """onChange={(e) => { setNivel(e.target.value); onChange({ cargo, nivel: e.target.value, torre }); }}""")

# 5. Add onChange for manual torre input 
text = text.replace("""onChange={(e) => setTorre(e.target.value)}""", """onChange={(e) => { setTorre(e.target.value); onChange({ cargo, nivel, torre: e.target.value }); }}""")

# 6. Add onChange for clicking torre from list
text = text.replace("""onClick={() => setTorre(`${t.name}: ${spec.name}`)}""", """onClick={() => { const newTorre = `${t.name}: ${spec.name}`; setTorre(newTorre); onChange({ cargo, nivel, torre: newTorre }); }}""")

# 7. Add onChange for setTorre('N/A')
text = text.replace("""onClick={() => setTorre('N/A')}""", """onClick={() => { setTorre('N/A'); onChange({ cargo, nivel, torre: 'N/A' }); }}""")

# 8. Add onChange for setCargo('')
text = text.replace("""onClick={() => setCargo('')}""", """onClick={() => { setCargo(''); setNivel(''); setTorre(''); onChange({ cargo: '', nivel: '', torre: '' }); }}""")

# 9. Add onChange for StepIndicator 2
text = text.replace("""onClick={() => cargo && setNivel('')}""", """onClick={() => { if(cargo){ setNivel(''); setTorre(''); onChange({ cargo, nivel: '', torre: '' }); } }}""")

# 10. Add onChange for StepIndicator 3
text = text.replace("""onClick={() => nivel && setTorre('')}""", """onClick={() => { if(nivel){ setTorre(''); onChange({ cargo, nivel, torre: '' }); } }}""")


with open('frontend/src/components/OrganizationalStructureSelector.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Edits applied")
