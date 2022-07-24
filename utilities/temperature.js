

async function fetchTemperature(min, max) {
    // fetch temperature 
    const response = await fetch(`https://www.random.org/integers/?num=1&min=${min}&max=${max}&col=1&base=10&format=plain&rnd=new`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }); 

    if (response.ok) {
        return response.json(); 
    } else {
        return 0; 
    }; 
}


module.exports = { fetchTemperature }