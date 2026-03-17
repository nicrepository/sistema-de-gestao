
import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/clientes/63');
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error body:', err.response?.data);
  }
}

test();