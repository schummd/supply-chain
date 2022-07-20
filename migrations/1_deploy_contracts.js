
const Registry = artifacts.require("AuthorityRegistry");
const Product = artifacts.require("Product"); 
const TempOracle = artifacts.require("TemperatureOracle");

module.exports = function(deployer, network, accounts) {
    
    const owner = accounts[0];              // supply chain contract owner 
    const DOA = accounts[9];                // Department of Agriculture owns a registry of CAs 

    deployer.then(async() => {
        await deployer.deploy(Registry, DOA); // on a different network 
        await deployer.deploy(TempOracle);
        await deployer.deploy(TempOracle.address, Product, Registry.address, owner); 
    });

    // deployer.deploy(Registry, DOA);
    // deployer.deploy(Product, DOA, owner); 
}