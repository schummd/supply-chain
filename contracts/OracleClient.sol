//SPDX-License-Identifier: UNLICENSED
 
pragma solidity ^0.8.0;

import "./OracleInterface.sol";


//The abstract class for the temperature oracle client
abstract contract TemperatureOracleClient {
    address _oracleAddress;

    constructor(address oracleAddress) {
        _oracleAddress = oracleAddress;
    } 

    // only the oracle should be able to update the data in the products contract
    modifier oracleOnly(){
        require(msg.sender == _oracleAddress, 'data must come from the oracle contract');
        _;
    }

    // function to request the temperature from the oracle temperature source
    // call request temperature for the given batch Id
    function requestTemperatureFromOracle(bytes32 batchId) internal 
    {
        // encode batch Id as data for the request
        OracleInterface(_oracleAddress).requestData(batchId);
    }

    // receive the data for the given request ID
    function receiveDataFromOracle(uint256 data, bytes32 batchId)
    oracleOnly() public returns (bool) {
        // convert bytes received into the received temperature and the 
        // batchId the temperature was requested for
        return receiveTemperatureFromOracle(batchId, data);
    }

    // define what to do with the received temperature in the products contract
    function receiveTemperatureFromOracle (
        bytes32 batchId, uint256 recvdTemp)
        internal virtual returns (bool);
}