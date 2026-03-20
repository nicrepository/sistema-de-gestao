const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\login\\OneDrive\\Área de Trabalho\\Projetos\\sistema-de-gest-o\\old.tsx', 'utf16le');
fs.writeFileSync('c:\\Users\\login\\OneDrive\\Área de Trabalho\\Projetos\\sistema-de-gest-o\\old_utf8.tsx', content, 'utf8');
