

// async function listener(oracleInstance, productInstance, oracleOwner, min, max) {

//     await oracleInstance.getPastEvents().then(async(ev) => {
//         await fetchTemperature(min, max).then(async(response) => {
//             await oracleInstance.replyTemp(ev[0].args[0], response, productInstance.address, { from: oracleOwner });
//         }); 
//     });

// }

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