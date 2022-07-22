const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 

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
	const distributor = accounts[2];    // batch distributor 
    const oracleOwner = accounts[8];

    // ------------------------------------------------------------------------------------------------

    it('Authority deploying CA registry contract', async () => {
        registryInstance = await Registry.deployed(); 
        await web3.eth.getBalance(registryInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    });

    it('Deploying oracle contract', async () => {
		oracleInstance = await Oracle.deployed();
		await web3.eth.getBalance(oracleInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
	}); 
    
    it('Deploying product contract', async () => {
		productInstance = await Product.deployed();
		await web3.eth.getBalance(productInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
	}); 

    it('DOA adding a certifying authority to the registry', async() => {
        CA = await authorityKeys(); // generate random account keys 
        authorityAddress = CA[0];	// certifying authority public key
        await registryInstance.addPublicKey(authorityAddress, { from: DOA }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
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

    it('Sending data through oracle', async () => {
        let res = await oracleInstance.replyTemp.call(batchID, 4,productInstance.address, {from: oracleOwner});
        assert.isTrue(res);
    });

    it('Sending data through oracle, temp too high', async () => {
        let res = await oracleInstance.replyTemp.call(batchID, 6,productInstance.address, {from: oracleOwner});
        assert.isFalse(res);
    });

})