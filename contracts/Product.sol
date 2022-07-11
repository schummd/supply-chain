// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProductContract {

    bool internal locked;                   // lock for payments (not sure if necessary yet)
    address owner;
    address CA; 

    // another option to map multiple structs:
    // https://ethereum.stackexchange.com/questions/82157/mapping-multiple-structs-to-a-struct-and-call-them
    
    // keeps the hash of product data and contions,
    // certificate infromation and the current owner 
    struct Product {
        bytes32 productHash; 
        bytes32 conditionsHash;
        bytes32 certificate; 
        uint256 expiration; 
        address issuer;
        address currentOwner;
        uint256 temperature;            // keeping temperature of storage from oracle 
    }

    // maps each product ID to a product data   
    mapping (bytes32 => Product) products; 

    // alternatively keep as array:
    // Product[] products; 

    constructor(address _owner) {
        owner = _owner; 
    }

    // only owner can call the function 
    modifier onlyOwner(address _owner) { require(msg.sender == _owner); _; }
    // only after that time can call the function 
    modifier onlyAfter(uint256 _time) { require(block.timestamp > _time); _; }
    // only before that time can call the function 
    modifier onlyBefore(uint256 _time) { require(block.timestamp < _time); _;}
    // lock against reentrancy 
    modifier lock() { 
        require(!locked); 
        locked = true; _; 
        locked = false;
    }

    // send generated product ID to off-chain 
    event productIdentifier(bytes32 productID); 


    /* PRODUCT FUNCTIONS ------------------------------------------------------------------ */

    // adds product data hash and conditions hash 
    function addProduct(bytes32 _data, bytes32 _conditions) public {
        bytes32 productID = bytes32(keccak256(abi.encodePacked(_data, _conditions))); 
        products[productID].productHash = _data; 
        products[productID].conditionsHash = _conditions; 
        products[productID].currentOwner = msg.sender; 
        emit productIdentifier(productID);
    }

    // only current owner 
    function updateProduct(bytes32 _updatedData) public {
        
    }

    // 
    function updateConditions(bytes32 _updateConditions) public {

    }

    // requires oracle 
    function updateTemperature(uint256 _temperature) public {

    }

    // update certificate data in product - only authorised CA 
    function updateCertificate(bytes32 _certificate, uint256 _expiration, address _issuer) public {

    }

    function getProduct(bytes32 _productID) public view returns(bytes32, bytes32, address) {
        return (products[_productID].productHash, products[_productID].conditionsHash, products[_productID].currentOwner);
    }


    /* CERTIFICATE FUNCTIONS ------------------------------------------------------------------ */
    
    // Daria's 

    function verifyCA(address _issuer) public {

    }

    function authoriseCA() public {

    }

}