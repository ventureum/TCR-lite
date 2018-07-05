var Registry = artifacts.require('./Registry.sol')
var Forum = artifacts.require('./Forum.sol')
var Token = artifacts.require('./VetXToken.sol')
var SafeMath = artifacts.require('./SafeMath.sol')
var DLLBytes32 = artifacts.require('./DLLBytes32.sol')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(SafeMath).then(function () {
    return deployer.link(SafeMath, [Registry, Token, Forum])
  }).then(function () {
    return deployer.deploy(Token, '1000000000000000000000000000', 'VetX', 18, 'VTX')
  }).then(function () {
    return deployer.deploy(DLLBytes32)
  }).then(function () {
    return deployer.link(DLLBytes32, [Registry, Forum])
  }).then(function () {
    return deployer.deploy(Registry, Token.address)
  }).then(function () {
    return deployer.deploy(Forum)
  })
}
