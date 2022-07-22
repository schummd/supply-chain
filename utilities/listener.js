const axios = require('axios');

async function getTempAPI() {
    const res = await axios({
        url: 'https://www.random.org/integers/',
        params: {
            num: 1,
            min: -10,
            max: 20,
            col: 1,
            base: 10,
            format: 'plain',
            rnd: 'new'
        },
            method: 'get'
        });
    
    return parseInt(res.data);
}

async function main(_owner, _oracleContractAddress, _oracleInstance) {
    // Initialize account
    const [ dataProvider ] = _owner; 

    // Initialize contract
    const oracleContractAddress = _oracleContractAddress;
    const oracleContractABI = _oracleInstance;
    const oracleContract = new hardhat.ethers.Contract(oracleContractAddress, oracleContractABI, dataProvider);
}

main();



// require('dotenv').config();
// const fs = require("fs");
// const https = require('axios');
// const Web3 = require('web3');

// //intialize Web3 with the Url of our environment as a variable
// const web3 = Web3(new Web3.providers.HttpProvider(process.env.RPC));
// //get contract address and abi file path from env vars
// const contractAddress = process.env.CON_ADDR;
// const contractAbi = JSON.parse(fs.readFileSync(process.env.ABI)).abi;
// //initialize contract variable
// var contract =  new Web3.eth.Contract(contractAbi, contractAddress);

// //simple function for calling API in Sydney(assumption)
// function callAPI(){
//     axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Sydney&appid={API key}`)
//         .then(res => {
//             return res.data.main.temp;
//   })
//   .catch(err => {
//     return "ERROR"
//   });
// }

// //While loop until program is canceled to continue to receive events
// while(true){
//     //initialize a contract listener for emmisions of the "NewJob" event, see web3.js for docs
//     contract.on("request", (batchId, caller) => {
//         //use lat and lon to call API
//         var temp = callAPI();
//         if(temp != "ERROR"){
//             //send data to updateWeather function on blockchain if temp is received
//             await contract.methods.replyTemp(batchId, temp, caller).send();
//         }
//     })
// }
