// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProductContract {

    bool internal locked;                   // lock for payments (not sure if necessary yet)
    address owner;

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
    }

    // maps each product entry to an integer  
    // mapping (uint256 => Product[]) products; 
    // alternatively keep as array:
    Product[] products; 

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

    /* PRODUCT FUNCTIONS ------------------------------------------------------------------ */

    // adds product data hash and conditions hash 
    function addProduct(bytes32 _data, bytes32 _conditions) public {
        products.push(Product(_data, _conditions, bytes32(0), 0, address(0), msg.sender)); 
    }

    function getProduct(uint256 _index) public view returns(bytes32, bytes32, address) {
        return (products[_index].productHash, products[_index].conditionsHash, products[_index].currentOwner); 
    }

}