
const Product = artifacts.require("Product");
const Registry = artifacts.require("AuthorityRegistry");
const truffleAssert = require('truffle-assertions');

const assert = require("chai").assert;
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 


contract('Product', (accounts) => {

    let CA; 
    let batchID; 
    let authorityAddress; 
    let productHash = web3.utils.sha3('product');
    let conditionsHash = web3.utils.sha3('conditions');
    let rejectedProductHash = web3.utils.sha3('I am trying to tamper with product');
    let newProductHash = web3.utils.sha3('I have updated the product quatity');

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const producer = accounts[1]; 
    const newOwner1 = accounts[2];
	const newOwner2 = accounts[3]; 
    const badActor = accounts[4]; 
    const thirdParty = accounts[5]; 



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
        // generate 2 random hashes for testing

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

    it('Producer authorises the CA to issue the certificate', async() => {
        await productInstance.updateCertAuthorisation(batchID, CA[0], { from: producer })
        let checkProduct = await productInstance.getProduct(batchID); 
        // console.log(CA[0]);
        // console.log(checkProduct); 
        assert.equal(checkProduct[3], CA[0], "check CA address was assigned to a batch");
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

    it('Verify that certificate has been issued by requested CA', async() => {
        let verifyCert = await productInstance.verifyIssuerAuthorisation.call(batchID); 
        assert.isTrue(verifyCert, "certificate issued by expected certifying authority");
    });

    it('Owner updates product hash', async() => {
        await productInstance.updateProduct(batchID, newProductHash, {from: producer})
        await productInstance.getPastEvents().then((ev) => batchHash = ev[0].args[0]); 
        assert.equal(batchHash, newProductHash, "product hash was not updated on chain correctly")
        productHash = newProductHash
    });

    it('Not owner, cannot update product', async() => {
        await truffleAssert.reverts(
            (productInstance.updateProduct(batchID, rejectedProductHash, {from: badActor})), "Only authorised address can call this function"
            );
    });

    it('Anyone can verify a product', async() => {
        await productInstance.verifyProductHash(batchID, productHash);
    });

    it('Anyone can verify a conditions', async() => {
        await productInstance.verifyConditionsHash(batchID, conditionsHash);
    });



})