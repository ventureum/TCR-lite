pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "@ventureum/kingston/contracts/handlers/IContractAddressHandler.sol";
import "@ventureum/kingston/contracts/handlers/IACLHandler.sol";
import "@ventureum/kingston/contracts/base/Base.sol";


contract Module is Base, Ownable {
    bytes32 constant public ACL_HANDLER_CI = keccak256("ACLHandler");
    bytes32 constant public CONTRACT_ADDRESS_HANDLER_CI = keccak256("ContractAddressHandler");

    address public storeAddr;

    IACLHandler public aclHandler;
    IContractAddressHandler public contractAddressHandler;

    modifier handlerOnly(bytes32 handlerCI) {
        require(msg.sender == kernel.handlers(handlerCI));
        _;
    }

    constructor(address kernelAddr) Base(kernelAddr) public {}

    function setHandler(bytes32 CI, address handlerAddr) public kernelOnly {
        super.setHandler(CI, handlerAddr);

        if (CI == ACL_HANDLER_CI) {
            aclHandler = IACLHandler(handlerAddr);
        }
        if (CI == CONTRACT_ADDRESS_HANDLER_CI) {
            contractAddressHandler = IContractAddressHandler(handlerAddr);
        }
    }

    function setStorage(address _storeAddr) public onlyOwner {
        storeAddr = _storeAddr;
    }

    function validate() internal view {
        super.validate();
        bytes32 srcCI = contractAddressHandler.reverseLookUp(msg.sender);
        require(aclHandler.isAuthorized(srcCI, CI, msg.sig));
    }
}
