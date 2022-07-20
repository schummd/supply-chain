//SPDX-License-Identifier: UNLICENSED

import "./OracleInterface.sol";

// The concrete class for the temperature oracle
contract TempOracle is Oracle {
    constructor(address tempSource) Oracle(tempSource) {}
}
