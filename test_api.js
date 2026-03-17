
async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/clientes/35');
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
