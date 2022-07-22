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