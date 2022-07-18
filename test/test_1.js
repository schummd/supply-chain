
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
    let reqConditionsHash = web3.utils.sha3('The required conditions are cold');
    let incorrectProductHash = web3.utils.sha3('I am trying to tamper with product');
    let newProductHash = web3.utils.sha3('I have updated the product quatity');
    let newConditionsHash = web3.utils.sha3('The required conditions are cold, dark')
    let incorrectConditionsHash = web3.utils.sha3('The batch was stored outside in direct sunlight');

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const producer = accounts[1]; 
    const newOwner = accounts[2];
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
        await productInstance.addProduct(productHash, reqConditionsHash, { from: producer })
        await productInstance.getPastEvents().then((ev) => batchID = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(batchID); 
        // console.log(checkProduct);
        
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        assert.equal(checkProduct[1], reqConditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[2], producer, "check the owner is the same who transacted"); 
    }); 

    it('Producer authorises the CA to issue the certificate', async() => {
        await productInstance.updateCertAuthorisation(batchID, CA[0], { from: producer })
        let checkProduct = await productInstance.getProduct(batchID); 
        // console.log(CA[0]);
        // console.log(checkProduct); 
        assert.equal(checkProduct[3], CA[0], "check CA address was assigned to a batch");
    }); 


    it('Adding bad certificate to the product', async() => {
        let BadCA = await authorityKeys();
        let certData = await generateCertificate(batchID, BadCA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 

        await truffleAssert.reverts(
            (productInstance.updateCertificate(batchID, certificate, signature, {from: producer})), "This certificate is not from the select authority"
        );

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
    });

    it('Not owner, cannot update product', async() => {
        await truffleAssert.reverts(
            (productInstance.updateProduct(batchID, incorrectProductHash, {from: badActor})), "Only authorised address can call this function"
        );
    });

    it('Anyone can verify a product', async() => {
        let prodVerify = await productInstance.verifyProductHash(batchID, newProductHash);
        assert.isTrue(prodVerify, 'The product could not be verified as expected', { from: thirdParty})
    });

    it('Anyone can verify a product is tampered with', async() => {
        let prodVerify = await productInstance.verifyProductHash(batchID, incorrectProductHash, { from: thirdParty});
        assert.isFalse(prodVerify, 'The product was verified when it should not have been')
    });
    

    it('Anyone can verify conditions', async() => {
        // get a hash of off chain conitions - actual conditions
        let actualConditionsHash = web3.utils.sha3('The required conditions are cold');
        let condVerify = await productInstance.verifyConditionsHash(batchID, actualConditionsHash, { from: thirdParty});
        assert.isTrue(condVerify, 'The conditions could not be verified')
    });

    it('Anyone can verify conditions are incorrect', async() => {
        let condVerify = await productInstance.verifyConditionsHash(batchID, incorrectConditionsHash, { from: thirdParty});
        assert.isFalse(condVerify, 'The conditions were verified when they were incorrect')
    });

    it('Anyone can verify a certificate', async() => {
        let certVerify = await productInstance.verifyCertificate(batchID, { from: thirdParty});
        assert.isTrue(certVerify, 'The certificate could not be verified')
    });

    it('Only owner can update conditions', async() => {
        await truffleAssert.reverts(
            (productInstance.updateConditions(batchID, incorrectConditionsHash, {from: badActor})), "Only authorised address can call this function"
        );
    });

    

    it('Can only sell if product can be verified', async() => {
        await productInstance.updateOwner(batchID, newOwner, reqConditionsHash, newProductHash, {from: producer})
        let productDetails = await productInstance.getProduct(batchID);
        assert.equal(productDetails[2], newOwner, "ownership was not correctly updated");
    });

    it('Old owner cannot update details anymore', async() => {
        await truffleAssert.reverts(
            (productInstance.updateConditions(batchID, newConditionsHash, {from: producer})), "Only authorised address can call this function"
        );
    });

    it('producer cannot update certificate after selling', async() => {
        let certData = await generateCertificate(batchID, CA[1]); 
        let certificate = certData[0];
        let signature = certData[1]; 
        await truffleAssert.reverts(
            (productInstance.updateCertificate(batchID, certificate, signature, {from: producer})), "You no longer own this batch"
        );
    });


})