// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CARegistry.sol"; 
import "./Oracle.sol";

contract Product is TemperatureOracleClient{

    bool internal locked;                   // lock for payments (not sure if necessary yet)
    address owner;
    // address CA;
    address DOA;                            // Department of Agriculture contract address 

    // another option to map multiple structs:
    // https://ethereum.stackexchange.com/questions/82157/mapping-multiple-structs-to-a-struct-and-call-them
    
    // keeps the hash of product data and contions,
    // certificate infromation and the current owner 
    struct Batch {
        bytes32 bardoce;                // get this from oracle, physical batch barcode
        bytes32 productHash; 
        bytes32 conditionsHash;

        bytes32 certificate; 
        bytes signature;                // created with web3.eth.sign(), bytes 

        address owner;
        address producer;

        uint256 reqTemperature;         // required temp of the product as provided in required conitions
        bool status;                    // the status of the product, true means ok - not sure if needed
    }

    // maps each product ID to a product data   
    mapping (bytes32 => Batch) products; 

    // alternatively keep as array:
    // Product[] products; 

    constructor(address oracleAddress, address _DOA, address _owner) TemperatureOracleClient(oracleAddress) {
        DOA = _DOA; 
        owner = _owner; 
    }

    ////////////////////////ORACLE //////////////////////////////
    // function to request the temperature from the oracle for a 
    // given batchId
    function getTemperature(bytes32 batchId) public 
    {
        requestTemperatureFromOracle(batchId, _recvdTemp);
    }

    function receiveTemperatureFromOracle(bytes32 batchId, uint256 recvdTemperature) internal override {
        // this will check received temp against required temp in products 
        compareTemperature(batchID, recvdTemperature);
    }


    /////////////////////////////////////////////////////////////


    modifier onlyThis(address _address) { require(msg.sender == _address, "Only authorised address can call this function"); _; }

    
    // lock against reentrancy 
    modifier lock() { 
        require(!locked); 
        locked = true; _; 
        locked = false;
    }

    // send generated product ID to off-chain 
    event batchIdentifier(bytes32 productID); 

    event batchCertificate(bytes32 certificate, bytes signature); 

    event batchProduct(bytes32 productHash);

    /* PRODUCT FUNCTIONS ------------------------------------------------------------------ */

    // adds product data hash and conditions hash 
    function addProduct(bytes32 _data, bytes32 _conditions) public {
        bytes32 batchID = bytes32(keccak256(abi.encodePacked(_data, _conditions))); 
        products[batchID].productHash = _data; 
        products[batchID].conditionsHash = _conditions; 
        products[batchID].owner = msg.sender; 
        products[batchID].producer = msg.sender;
        products[batchID].status = true;
        emit batchIdentifier(batchID);
    }

    // the owner can update the product hash
    function updateProduct(bytes32 _batchID, bytes32 _updatedData) public onlyThis(products[_batchID].owner) {
        products[_batchID].productHash = _updatedData;
        emit batchProduct(_updatedData);
    }

    // the owner can send a new product contions hash
    function updateConditions(bytes32 _batchID, bytes32 _updatedConditions) public onlyThis(products[_batchID].owner) {
        products[_batchID].conditionsHash = _updatedConditions;
    }

    // update certificate data in product - only authorised CA 
    function updateCertificate(bytes32 _batchID, bytes32 _certificate, bytes memory _signature) public onlyThis(products[_batchID].producer) {
        require(products[_batchID].owner == products[_batchID].producer, "You no longer own this batch"); 
        products[_batchID].certificate = _certificate; 
        products[_batchID].signature = _signature; 
        emit batchCertificate(_certificate, _signature);
    }

    function updateOwner(bytes32 _batchID, address _newOwner, bytes32 _offchainConditions, bytes32 _offchainProduct) public onlyThis(products[_batchID].owner) {
        require(verifyCertificate(_batchID) == true, "certificate could not be verified"); 
        require (verifyConditionsHash(_batchID, _offchainConditions) == true, "product conditions could not be verified");
        require (verifyProductHash(_batchID, _offchainProduct) == true, "product data could not be verified");
        products[_batchID].owner = _newOwner; 
    }

    /* VERIFICATION FUNCTIONS ----------------------------------------------------------------- */

    // allow anyone to verify data in the off chain data store about product
    function verifyProductHash(bytes32 _batchID, bytes32 _offchainHash) public view returns (bool) {
        if (products[_batchID].productHash == _offchainHash) { return true;}
        return false;
    }

    // allow anyone to verify data in the off chain data store about conditions
    function verifyConditionsHash(bytes32 _batchID, bytes32 _offchainHash) public view returns (bool){
        if (products[_batchID].conditionsHash == _offchainHash) { return true;}
        return false;
    }

    /* GETTER FUNCTIONS ----------------------------------------------------------------------- */

    function getProduct(bytes32 _batchID) public view returns(bytes32, bytes32, address) {
        return (products[_batchID].productHash, products[_batchID].conditionsHash, products[_batchID].owner);
    }

    /* TEMPERATURE FUNCTIONS ------------------------------------------------------------------ */

    // requires oracle 
    // have restricted to private so anyone cannot call this 
    // is there a way to resctrict this to the oracle?
    function compareTemperature(bytes32 _batchID, uint256 _temperature) private returns (bool) {
        if (_temperature != products[_batchID].reqTemperature) {
            products[_batchID].status = false;
            return false;
        }
        return true;
    }

    /* CERTIFICATE FUNCTIONS ------------------------------------------------------------------ */

    // anyone can send a product ID and verify its certificate
    // should check if the certificate exists first, if not then false 
    function verifyCertificate(bytes32 _batchID) public view returns(bool) {
        bytes32 certificate = products[_batchID].certificate; 
        bytes memory signature = products[_batchID].signature; 
        // recovered issuer from the certificate and his signature 
        address issuer = recoverIssuer(certificate, signature); 
        if (verifyIssuer(issuer) == true) { return true; }
        return false; 
    }

    // verify that the certifying authority is registered with DOA 
    // and eligible to issue organic certificates
    function verifyIssuer(address _issuer) internal view returns(bool) {
        AuthorityRegistry registry = AuthorityRegistry(DOA);  
        return registry.checkPublicKey(_issuer);
    }

    /**
     * @notice functions recovers the signer of the certificate from the provided certificate 
               (message signed by authority) and signature 
     * @dev    called internally from placeBid function  
     * @param  _hash the batch certificate signed by CA 
     * @param  _sig CA's bytes signature generated using web3.eth.sign()
     * @return issuer address (authority who issued/signed the organic certificate to the product batch)
    **/
    // copyright: https://github.com/protofire/zeppelin-solidity/blob/master/contracts/ECRecovery.sol
    function recoverIssuer(bytes32 _hash, bytes memory _sig) internal pure returns(address) {
        bytes32 r; bytes32 s; uint8 v;
        //Check the signature length
        if (_sig.length != 65) { return (address(0)); }
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        if (v < 27) { v += 27; }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) { return (address(0)); } 
        else { return ecrecover(_hash, v, r, s); }
    }

}