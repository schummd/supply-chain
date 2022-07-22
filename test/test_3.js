const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const Oracle = artifacts.require("Oracle");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
// const timeMachine = require('ganache-time-traveler');

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

    it('Authority deploying CA registry contract', async () => {
        oracleInstance = await Oracle.deployed(); 
        await web3.eth.getBalance(oracleInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    });
    
    it('Deploying product constract', async () => {
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

    // ------------------------------------------------------------------------------------------------
    // producer adds data about the batch he produced to the off-chain 
    // IPFS storage, sends the JSON object to the distributed file system; 
    // the data is accepted though off-chain front-end application

    it('Producer sending product data to the database', async() => {
        // database is imitated using a simple JSON object that stores the
        // infromation about the product; producer can add their own data 
        // and send it to the IPFS storage, which can be retrieved later on 
        productInfo = {
            "barcode": "1845678901001",
            "quantity": 1100,
            "productName": "Gala Apples",
            "produceDate": "01/01/2023",
            "expiryDate": "20/01/2023",
            "producer": "Sydney Orchard",
            "location": "Newcastle, NSW",
            "phone": "0403332323",
            "email": "hello@sydneyorchard.com.au", 
            "description": "apples",
            "saleContract": "#4513404285"
        }
        console.log(); 
        // initiate a global node for user 
        await initGlobalIpfs(); 
        // store data of the product and get the CID
        productCID = await loadIpfs(productInfo); 
        // verify the data stored is correct in IPFS 
        let retrieveData = await getIpfs(productCID); 
        assert.equal(JSON.stringify(productInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Contract owner authorising producer', async() => {
        // contract deployer declares a producer as authorised 
        await productInstance.addProducer(producer, { from: owner }); 
        let verifyProducer = await productInstance.getProducer.call(producer); 
        assert.isTrue(verifyProducer, "check if producer authorised in contract"); 
    });

    it('Producer adding product to the product contract', async() => {
        // retrieve data from the file storage 
        let retrieveData = await getIpfs(productCID); 
        // generate hash of the data 
        let productHash = web3.utils.sha3(retrieveData);
        let temperature = 5; 
        let stringCID = productCID.toString();

        // add a product to the contract 
        await productInstance.addProduct(productHash, temperature, stringCID, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        // assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[1], producer, "check the owner is the same who transacted"); 
        assert.equal(checkProduct[2], true);
    }); 

    it('Sending data through oracle', async () => {
        let res = await oracleInstance.replyTemp(batchID, 4,productInstance.address, {from: oracleOwner});
        let status = await productInstance.getProduct(batchID);
        assert.equal(status[2], true);
    });

    it('Sending data through oracle, temp too high', async () => {
        let res = await oracleInstance.replyTemp(batchID, 6,productInstance.address, {from: oracleOwner});
        let status = await productInstance.getProduct(batchID);
        assert.equal(status[2], false);
    });

})