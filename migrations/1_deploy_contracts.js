
const CARegistry = artifacts.require("CARegistryContract");
const Product = artifacts.require("ProductContract"); 

module.exports = function(deployer, network, accounts) {
    const owner = accounts[0]; 
    deployer.deploy(CARegistry, owner);
    deployer.deploy(Product, owner); 
}