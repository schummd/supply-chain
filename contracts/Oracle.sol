//SPDX-License-Identifier: UNLICENSED
 
pragma solidity ^0.8.0;
import "./OracleClient.sol";
// abstract class for oracle contract, which implements the oracle interface
contract Oracle is OracleInterface {
    event request(bytes32 batchId, address caller);

    address public owner;

    // only get temperature from declared source
    modifier trusted(address _serverAddr) {
        require(_serverAddr == owner, 'data must come from the trusted source'); _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    // emit a request for temperature data for the given batchId for the 
    // listener to hear
    function requestData(bytes32 _batchID) public override {
        emit request(_batchID, msg.sender);
    }
    
    // send the data from the oracle to the client
    function replyTemp(bytes32 _batchID, uint256 _data, address _caller) public virtual trusted(msg.sender) returns (bool){
        return TemperatureOracleClient(_caller).receiveDataFromOracle(_data, _batchID);
    }
}