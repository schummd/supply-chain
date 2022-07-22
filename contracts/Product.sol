// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CARegistry.sol"; 
import "./OracleClient.sol";

contract Product is TemperatureOracleClient {
    bool internal halted;
    bool internal locked;               // lock for payments (not sure if necessary yet)
    address payable owner;              // owner of this contract (who deployed)
    address DOA;                        // Department of Agriculture contract address 

    struct Batch {                      // keeps the hash of product data and conditions 
        bytes32 productHash;            // hash of the data stored off-chain 
        bytes32 certificate;            // organic product certification 
        bytes signature;                // created with web3.eth.sign(), bytes by issuer 
        address owner;                  // current owner of the product batch 
        address producer;               // who produced the batch 
        uint256 temperature;            // required temp of the product as provided in required conitions
        bool status;                    // the status of the product, true means ok - not sure if needed
    }
    uint256 _recvdTemp;

    
    mapping (bytes32 => Batch) products;    // maps each product ID to a product data   
    mapping (bytes32 => string) database;   // maps batchID to IPFS storage link 
    mapping (address => bool) producers;    // eligible producers to add products 

    constructor(address oracleAddress, address _DOA, address payable _owner) TemperatureOracleClient(oracleAddress) {
        DOA = _DOA; 
        owner = _owner; 
    }

    ////////////////////////ORACLE //////////////////////////////
    // function to request the temperature from the oracle for a 
    // given batchId
    function getTemperature(bytes32 batchId) public 
    {
        // send a request to the oracle for the temperature
        requestTemperatureFromOracle(batchId);
        // remember what oracle requests are associated with what batches

    }

    // receive the reply from the oracle
    function receiveTemperatureFromOracle(bytes32 batchId, uint256 recvdTemp) internal override returns (bool) {
        // this will check received temp against required temp in products 
        return compareTemperature(batchId, recvdTemp);

    }
    /////////////////////////////////////////////////////////////


    modifier onlyThis(address _address) { require(msg.sender == _address, "Only authorised address can call this function"); _; }

    modifier notHalted () {require(halted == false, 'The contract has been halted'); _;}

    modifier isHalted () {require(halted == true, 'The contract is not halted'); _;}
    
    // check if the caller the current owner of the batch
    modifier onlyOwner(address _address, bytes32 _batchID) { require(products[_batchID].owner == msg.sender, "only owner can call this function"); _; }
    // check if the producer authorised to add products
    modifier onlyProducer(address _address) { require(producers[_address] == true, "only authorised producer can call this function"); _; }
    // check if the caller is the contract owner 
    modifier onlyDeployer() { require(owner == msg.sender, "only contract owner can call this function"); _; }
    // lock against reentrancy 
    modifier lock() { 
        require(!locked); 
        locked = true; _; 
        locked = false;
    }

    // send generated product ID to off-chain 
    event batchIdentifier(bytes32 productID); 

    /* PRODUCT FUNCTIONS ------------------------------------------------------------------ */

    /**
     * @notice contract deployer adds authorised producer
     *         to the mapping, which gives permissions to 
     *         add products and certificate 
     * @dev    only contract owner can call 
     * @param  _producer batch producer address 
    **/
    function addProducer(address _producer) public 
    notHalted()
    onlyDeployer() {
        producers[_producer] = true; 
    }

    /**
     * @notice add product infromation to the data hash
     *         and conditions hash generated from off-chain
     * @dev    only registered producer can call 
     * @param  _data product data hash 
     * @param  _temperature stores required temperature
     * @param  _CID unique identifier of the off-chain storage
    **/
    function addProduct(bytes32 _data, uint256 _temperature, string memory _CID) public 
    notHalted()
    onlyProducer(msg.sender) {
        bytes32 batchID = bytes32(keccak256(abi.encodePacked(_data))); 
        products[batchID].productHash = _data; 
        products[batchID].owner = msg.sender; 
        products[batchID].producer = msg.sender;
        products[batchID].temperature = _temperature; 
        products[batchID].status = true;
        database[batchID] = _CID; 
        emit batchIdentifier(batchID);
    }

    /**
     * @notice producer adds a certificate obtained from the 
     *         CA from off-chain, the producer has to be the 
     *         current batch owner to add certificate 
     * @dev    only the producer of the product can call 
     * @param  _batchID unique identifier of the batch 
     * @param  _certificate certificate certifying product batch
     * @param  _signature signature of the certificate issuer 
    **/
    function addCertificate(bytes32 _batchID, bytes32 _certificate, bytes memory _signature) public 
    notHalted()
    onlyOwner(msg.sender, _batchID) {
        require(products[_batchID].producer == products[_batchID].owner, "producer of the batch is not the owner"); 
        products[_batchID].certificate = _certificate; 
        products[_batchID].signature = _signature; 
    }

    /**
     * @notice transfer the ownership of the product batch, supported by 
     *         certificate verification and check of the product hash
     *         that is stored on-chain and freshly computed one
     * @dev    only the current owner of the product can call 
     * @param  _batchID unique identifier of the batch 
     * @param  _productHash hash of the product to verify
     * @param  _newOwner address of a new batch owner 
    **/
    function updateOwner(bytes32 _batchID, bytes32 _productHash, address _newOwner) public
    notHalted()
    onlyOwner(msg.sender, _batchID) {
        require(verifyProductHash(_batchID, _productHash) == true, "product hash verification failed"); 
        require(verifyCertificate(_batchID) == true, "certificate verification failed");
        products[_batchID].owner = _newOwner; 
    }

    /* VERIFICATION FUNCTIONS ----------------------------------------------------------------- */

    /**
     * @notice allows to verify data in the off-chain data store about product
     * @dev    anyone can call 
     * @param  _batchID unique identifier of the batch 
     * @param  _offchainHash certificate certifying product batch
     * @return bool if the hash stored on-chain is the same as newly computed hash,
     *         then product infromation is correct and has not been modified 
    **/
    function verifyProductHash(bytes32 _batchID, bytes32 _offchainHash) public 
    notHalted()
    view returns (bool) {
        if (products[_batchID].productHash == _offchainHash) { return true;}
        return false;
    }

    /* GETTER FUNCTIONS ----------------------------------------------------------------------- */

    /**
     * @notice checks whether the producer address is
     *         authorised to add product and certificate
     * @dev    anyone can call function 
     * @param  _producer batch producer address 
     * @return bool true if address is in mapping 
    **/
    function getProducer(address _producer) public view 
    notHalted()
    returns(bool) {
        return producers[_producer]; 
    }

    /**
     * @notice get the product hash and owner by its unique ID
     * @dev    anyone can call function 
     * @param  _batchID unique batch ID to get the product 
     * @return bytes32 product hash stored on-chain 
     * @return address of the current owner of the batch 
    **/
    function getProduct(bytes32 _batchID) public view 
    notHalted()
    returns(bytes32, address) {
        return (products[_batchID].productHash, products[_batchID].owner);
    }

    /**
     * @notice get the product certificate and signer signature
     * @dev    anyone can call function 
     * @param  _batchID unique batch ID to get the product 
     * @return bytes32 batch certificate on-chain
     * @return bytes array of the issuer signature
    **/
    function getCertificate(bytes32 _batchID) public view 
    notHalted()
    returns(bytes32, bytes memory) {
        return (products[_batchID].certificate, products[_batchID].signature); 
    }

    /**
     * @notice get the product off-chain storage location 
     * @dev    anyone can call function 
     * @param  _batchID unique batch ID to get the product 
     * @return string unique IPFS storage identifier (CID)
    **/
    function getDatabase(bytes32 _batchID) public view 
    notHalted()
    returns(string memory) {
        return database[_batchID]; 
    }

    /* TEMPERATURE FUNCTIONS ------------------------------------------------------------------ */

    // requires oracle 
    // have restricted to private so anyone cannot call this 
    // is there a way to resctrict this to the oracle?
    function compareTemperature(bytes32 _batchID, uint256 _temperature) private 
    notHalted()
    returns (bool)
    {
        if (_temperature > products[_batchID].temperature) {
            products[_batchID].status = false;
            return false;
        }
        return true;
    }


    // allow owner to reset product status in the event of oracle malfunction
    // they must provide an alternative temperature reading
    function updateStatus(bytes32 _batchID, uint256 _temperature) public
    notHalted()
    onlyThis(products[_batchID].owner)
    {
        compareTemperature(_batchID, _temperature);
    }

    // following can only be executed by contract owner
    function emergencyHalt()
    onlyDeployer()
    notHalted()
    public 
    {
        halted = true;
    }

    function restartContract() public
    onlyDeployer()
    isHalted()
    {
        halted = false;
    }

    /* CERTIFICATE FUNCTIONS ------------------------------------------------------------------ */

    /**
     * @notice based the product certificate and issuer signature
     *         recovers the address of CA who signed the certificate
     *         and verifies whether it is registered with DOA 
     * @dev    anyone can call function 
     * @param  _batchID unique batch ID to get the product 
     * @return bool if the issuer is registered with DOA, then 
     *         certificate is valid, otherwise returns false 
    **/
    function verifyCertificate(bytes32 _batchID) public view
    notHalted()
    returns(bool) {
        bytes32 certificate = products[_batchID].certificate; 
        bytes memory signature = products[_batchID].signature; 
        // recovered issuer from the certificate and his signature 
        address issuer = recoverIssuer(certificate, signature); 
        if (verifyIssuer(issuer) == true) { return true; }
        return false; 
    }

    /**
     * @notice verify that the certifying authority is ligitimate
     *         and has been registrered with DOA registry contract,
     *         and thus eligible to issue organic certificates
     * @dev    other functions from this contract can call
     * @param  _issuer unique batch ID to get the product 
     * @return bool true if the issuer registered with DOA,
     *         otherwise false
    **/
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

    /* UTILITIES FUNCTIONS -------------------------------------------------------------------- */

    /**
     * @notice deactivate contract 
     * @dev    only the contract owner / deployer can call
    **/
    function destroyContract() public onlyDeployer() {
        selfdestruct(owner); 
    }

}