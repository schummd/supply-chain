const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 
const { fetchTemperature } = require('../utilities/temperature'); 

contract('Product', (accounts) => {

    let CA;         
    let batchID; 
    let authorityAddress;               // CA's public key 

    let productInfo;                    // producer's product data 
    let productCID;                     // keeps the ID of the product in IPFS
    let newProductHash;                 // newly computed hash of the product 

    const DOA = accounts[9];            // certification registry owner 
	const owner = accounts[0];          // contract owner 
	const producer = accounts[1];       // batch producer
    const oracle = accounts[8];

    before('Deploying contracts', async() => {
        registryInstance = await Registry.deployed(); 
        oracleInstance = await Oracle.deployed(); 
        productInstance = await Product.deployed();

        console.log("\nContracts deployed and IPFS node initialised..."); 
        await initGlobalIpfs();   // initiate a global IPFS node for user 

        await web3.eth.getBalance(productInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    }); 

    // ------------------------------------------------------------------------------------------------

    it('DOA adding a certifying authority to the registry', async() => {
        CA = await authorityKeys(); // generate random account keys 
        authorityAddress = CA[0];	// certifying authority public key
        await registryInstance.addPublicKey(authorityAddress, { from: DOA }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

    // ------------------------------------------------------------------------------------------------

    it('Producer sending product batch data to the database', async() => {
        // database is imitated using a simple JSON object; assuming 
        // producer adds the product data though front-end interface
        // sends it to the IPFS storage
        productInfo = {
            "barcode": "3540525823999",
            "quantity": 990,
            "productName": "Southern Watermelons",
            "produceDate": "14/02/2023",
            "expiryDate": "15/04/2023",
            "producer": "Sydney Orchard",
            "location": "Newcastle, NSW",
            "phone": "0403332323",
            "email": "hello@sydneyorchard.com.au", 
            "description": "watermelons",
            "saleContract": "#473875285"
        }

        productCID = await loadIpfs(productInfo);       // store data of the product and get the CID
        let retrieveData = await getIpfs(productCID);   // verify the data stored is correct in IPFS 
        assert.equal(JSON.stringify(productInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Contract owner authorising producer', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producer); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Contract owner authorising producer', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producer); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Producer adding product to the product contract', async() => {
        // retrieve data from the file storage 
        // generate hash of the data 
        let productHash = web3.utils.sha3('data from the data base');
        let temperature = 5; 
        let stringCID = 'databasestring';

        // add a product to the contract 
        await productInstance.addProduct(productHash, temperature, stringCID, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        // assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[1], producer, "check the owner is the same who transacted"); 
    }); 

    // ------------------------------------------------------------------------------------------------

    // it('Sending data through oracle', async () => {
    //     let res = await oracleInstance.replyTemp.call(batchID, 4,productInstance.address, {from: oracle });
    //     assert.isTrue(res);
    // });

    // it('Sending data through oracle, temp too high', async () => {
    //     let res = await oracleInstance.replyTemp.call(batchID, 6,productInstance.address, {from: oracle });
    //     assert.isFalse(res);
    // });

})