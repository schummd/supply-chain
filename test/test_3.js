const Product = artifacts.require("Product");
const Oracle = artifacts.require('Oracle');
const Registry = artifacts.require("AuthorityRegistry");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

const { authorityKeys, generateSignature, generateCertificate } = require('../utilities/certificate.js'); 


contract('Product', (accounts) => {

    let CA; 
    let batchID; 
    let authorityAddress; 

    const DOA = accounts[9];        // certification registry owner 
	const owner = accounts[0];      // contract owner 
	const producer = accounts[1]; 
	const b = accounts[2]; 
    const oracleOwner = accounts[8];



    it('Authority deploying CA registry contract', async () => {
        registryInstance = await Registry.deployed(); 
        await web3.eth.getBalance(registryInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    });

    it('Deploy the temperature oracle', async () => {
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

    it('Adding product to the product contract', async() => {
        // generate 2 random hashes for testing
        let productHash = web3.utils.sha3('product');
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

        await productInstance.addRequiredTemp(batchID, 5, {from: producer});
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