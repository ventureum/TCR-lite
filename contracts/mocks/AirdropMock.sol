pragma solidity^0.4.24;


contract AirdropMock {

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

        msg.sender.send(1);
    }
}
