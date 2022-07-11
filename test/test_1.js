const Product = artifacts.require("ProductContract");
const CARegistry = artifacts.require("CARegistryContract");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');


// async function getProductID() {
//     let checkProduct = productInstance.getProduct(ev[0].args[0]); 
//     return checkProduct; 
// }


contract('Product', (accounts) => {

    // contract owner 
	const owner = accounts[0]; 
	const a = accounts[1]; 
	const b = accounts[2]; 

    it('Authority deploying CA registry contract', async () => {
        registryInstance = await CARegistry.deployed(); 
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

    it('Adding product to the product contract', async() => {
        // generate 2 random hashes for testing
        let productHash = web3.utils.sha3('product');
        let conditionsHash = web3.utils.sha3('conditions');

        let newProduct; // keeps the productID

        // add a product to the contract 
        await productInstance.addProduct(productHash, conditionsHash, { from: a })
        await productInstance.getPastEvents().then((ev) => newProduct = ev[0].args[0]); 

        // get the product infromation 
        let checkProduct = await productInstance.getProduct(newProduct); 
        // console.log(checkProduct);
        
        // check if the data is correct 
        assert.equal(checkProduct[0], productHash, "check the supplied product hash is the same as stored"); 
        assert.equal(checkProduct[1], conditionsHash, "check the supplied conditions hash is the same as stored"); 
        assert.equal(checkProduct[2], a, "check the owner is the same who transacted"); 
    }); 

})