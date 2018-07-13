pragma solidity^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract AirdropMock {
    ERC20 public token;

    constructor (address _tokenAddress) {
        token = ERC20(_tokenAddress);
    }

    // a mocked whitelist
    function whitelisted(address addr) internal view returns (bool) {
        return true;
    }

    function validate() external view returns (bool) {
        return whitelisted(msg.sender);
    }

    // for test reason, transfer 1 ether to target user.
    function airdrop() external {
        require(whitelisted(msg.sender));

        token.transfer(msg.sender, 1);
    }
}
