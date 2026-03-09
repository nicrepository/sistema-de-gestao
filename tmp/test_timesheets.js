import fetch from 'node-fetch';

async function testTimesheets() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YmZpYnBteWxrZmtmcWFyY2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzAwNDAsImV4cCI6MjA3OTg0NjA0MH0.jXBE-HnVJNAg2pPjlPu8THjnNfVnJADdlNEOvlyiUFU'; // substitua pelo token caso necessário ou remova para testar sem
    const url = 'http://localhost:3000/api/v1/timesheets?limit=10';

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        console.log(data);
    } catch (err) {
        console.error(err);
    }
}

testTimesheets();
