
const Oracle = artifacts.require("Oracle");

contract('Oracle', (accounts) => {

    let oracleInstance; 

    before('setup contract', async() => {
        oracleInstance = await Oracle.deployed(); 

        // monitor for events 
        oracleInstance.temperatureRequest("temperatureRequest", (error, result) => {
            // if(error) { console.error(error); }
            console.log("received request"); 
            oracleInstance.replyTemp.call(result.args.batchID, 6, result.args.caller);
        }); 

    });

});



// async function getTempAPI() {
//     const res = await axios({
//         url: 'https://www.random.org/integers/',
//         params: {
//             num: 1,
//             min: -10,
//             max: 20,
//             col: 1,
//             base: 10,
//             format: 'plain',
//             rnd: 'new'
//         },
//             method: 'get'
//         });
    
//     return parseInt(res.data);
// }

// async function main(_owner, _oracleContractAddress, _oracleInstance) {
    

// }
