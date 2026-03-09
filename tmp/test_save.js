async function testUpdate() {
    const url = 'http://localhost:3000/api/colaboradores/44';
    const data = {
        nome_colaborador: 'Alon Guimarães TEST',
        cargo: 'Software Architect'
    };

    try {
        console.log('Enviando PUT para:', url);
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        console.log('Resposta:', response.status, result);
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

testUpdate();
