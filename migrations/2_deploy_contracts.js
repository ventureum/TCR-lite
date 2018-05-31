var Registry = artifacts.require('./Registry.sol')
var Token = artifacts.require('./VetXToken.sol')
var SafeMath = artifacts.require('./SafeMath.sol')
var DLLBytes32 = artifacts.require('./DLLBytes32.sol')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(SafeMath).then(function() {
    return deployer.link(SafeMath, [Registry, Token])
  }).then(function() {
    return deployer.deploy(Token, '1000000000000000000000000000', 'VetX', 18, 'VTX')
  }).then(function() {
    return deployer.deploy(DLLBytes32);
  }).then(function() {
    return deployer.link(DLLBytes32, Registry);
  }).then(function() {
    return deployer.deploy(Registry, Token.address);
  })
}
