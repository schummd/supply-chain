const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 
const { initGlobalIpfs, loadIpfs, getIpfs } = require('../utilities/storage'); 

contract('Product', (accounts) => {

    let CA; 
    let batchID; 
    let authorityAddress; 

    let productInfo;                // producer's product data 
    let productCID;             // keeps the ID of the product in IPFS

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const producer = accounts[1]; 
	const b = accounts[2]; 

    it('Producert sending product data to the database', async() => {
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
            "description": "apples"
        }
    
        // initiate a global node for user 
        await initGlobalIpfs(); 
        // store data of the product and get the CID
        productCID = await loadIpfs(productInfo); 
        // verify the data stored is correct in IPFS 
        let retrieveData = await getIpfs(productCID); 
        // console.log(productCID);
        assert.equal(JSON.stringify(productInfo), retrieveData, "the data stored on IPFS is the same"); 
    });

    it('Authority deploying CA registry contract', async () => {
        registryInstance = await Registry.deployed(); 
        await web3.eth.getBalance(registryInstance.address).then((balance) => {
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

    it('Adding product to the product contract', async() => {
        // retrieve data from the file storage 
        let retrieveData = await getIpfs(productCID); 

        // generate 2 random hashes for testing
        let productHash = web3.utils.sha3(retrieveData);
        let conditionsHash = web3.utils.sha3('conditions');

        // add a product to the contract 
        await productInstance.addProduct(productHash, conditionsHash, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // console.log(checkProduct);
        
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[2], producer, "check the owner is the same who transacted"); 
    }); 


    it('Adding certificate to the product', async() => {
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 
        let returnedCertificate; 
        let returnedSignature; 

        // console.log(certificate);
        // console.log(signature); 

        await productInstance.updateCertificate(batchID, certificate, signature, { from: producer }); 
        await productInstance.getPastEvents().then((ev) => returnedCertificate = ev[0].args[0]);
        await productInstance.getPastEvents().then((ev) => returnedSignature = ev[0].args[1]);
        // console.log(returnedCertificate);
        // console.log(returnedSignature); 

        assert.equal(certificate, returnedCertificate, "check the certificated stored is the same"); 
        assert.equal(signature, returnedSignature, "check the signature stored is the same"); 
    });

    it('Verify the certificate of the batch', async() => {
         let verification = await productInstance.verifyCertificate(batchID);
         assert.isTrue(verification, "batch certificate was signed by a valid authority"); 
    });

})