pragma solidity ^0.4.24;

import "../Module.sol";
import "vetx-token/contracts/VetXToken.sol";


contract ReputationExchange is Module {
    using SafeMath for uint;

    event PurchaseReputation(
        address indexed sender,
        address indexed purchaser,
        uint indexed value,
        uint timestamp);

        //uint256[] indexed values,
        //address[] indexed beneficiaries,
    event BatchExchange(
        address indexed admin,
        address[] beneficiaries,
        uint256[] values,
        uint timestamp);

    VetXToken public token;

    constructor (address kernelAddr, address vetXAddress) Module(kernelAddr) public {
        CI = keccak256("ReputationExchange");
        token = VetXToken(vetXAddress);
    }

    /*
     * purchase reputation
     * This function only transfer and store vtx to this contract
     * and then send an event. The backend server should catch this event and 
     * make a decision how many reputations they will gain.
     * the server side reputation = 
        max(
            min(currentReputation + value * rate, minReputationThreshold),
            currentReputation)
     *
     * @param purchaser the address of the purchaser.
     * @param value the number of vtx purchaser want pay.
     */
    function purchaseReputation(address purchaser, uint value) external {
        token.transferFrom(purchaser, this, value);

        emit PurchaseReputation(
            msg.sender,
            purchaser,
            value,
            now);
    }

    /*
     * Transfer vtx to each beneficiaries 
     * This function is connected and can only be called by back-end server
     *  back-end server will update the changes for a period of time (normal once a day)
     * 
     * @param beneficiaries the addresses of the beneficiaries.
     * @param values the values that will transfer to beneficiaries.
     */
    function batchExchange(address[] beneficiaries, uint[] values) {
        require(beneficiaries.length == values.length);

        for (uint i = 0; i < values.length; i++) {
            token.transfer(beneficiaries[i], values[i]);
        }

        emit BatchExchange(
            msg.sender,
            beneficiaries,
            values,
            now);
    }
}
