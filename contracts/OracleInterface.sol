//SPDX-License-Identifier: UNLICENSED

// CREDIT: https://github.com/COMP6452-UNSW/oracle_example/tree/master/smart_contracts (adapted from above git repo)
 
pragma solidity ^0.8.0;
// contract that defines the interface to interact with oracle
interface OracleInterface {
    function requestData(bytes32 batchId) external;
}

