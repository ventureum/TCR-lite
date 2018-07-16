pragma solidity^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract AirdropMock {
    ERC20 public token;

    address constant NULL = address(0x0);

    constructor (address _tokenAddress) {
        token = ERC20(_tokenAddress);
    }

    // a mocked whitelist
    function whitelisted(address addr) internal view returns (bool) {
        return true;
    }

    function validate(address targetAddress) external view {
        require(targetAddress != NULL);
        require(whitelisted(targetAddress));
    }

    // for test reason, transfer 1 ether to target user.
    function airdrop(address targetAddress) external {
        require(targetAddress != NULL);
        require(whitelisted(targetAddress));

        token.transfer(targetAddress, 1);
    }
}
