'use strict'

const OwnSolConfig = require('../config/ownSolConfig.js')
const ThirdPartySolConfig = require('../config/thirdPartySolConfig.js')

const Configuation = require('../config/configuation.js')

// Get Constant
const _ownSolConstants = OwnSolConfig.default(artifacts)
const _thirdPartySolConstants = ThirdPartySolConfig.default(artifacts)

// Own contracts:
const Library = _ownSolConstants.Library
const Registry = _ownSolConstants.Registry
const Forum = _ownSolConstants.Forum
const ReputationExchange = _ownSolConstants.ReputationExchange

// --------- third party contracts ------------
//* Token
const VetXToken = _thirdPartySolConstants.VetXToken

//* SafeMath
const SafeMath = _thirdPartySolConstants.SafeMath

//* Kernel
const Kernel = _thirdPartySolConstants.Kernel

//* Handlers
const ACLHandler = _thirdPartySolConstants.ACLHandler
const ContractAddressHandler = _thirdPartySolConstants.ContractAddressHandler

module.exports = function (deployer, network, accounts) {
  let instances = {}

  deployer.deploy(SafeMath.Self).then(function () {
    return deployer.link(
      SafeMath.Self,
      [Registry.Self,
      VetXToken.Self,
      Forum.Self])
  }).then(async function () {
    await deployer.deploy(Library.DLLBytes32)
    await deployer.link(
      Library.DLLBytes32,
      [Forum.Self,
      Registry.Self])

    // deploy VetXToken
    await deployer.deploy(
      VetXToken.Self,
      VetXToken.initAmount,
      VetXToken.tokenName,
      VetXToken.decimalUnits,
      VetXToken.tokenSymbol)

    // deploy Kingston kernel system
    await deployer.deploy(Kernel.Self)
    await deployer.deploy(ACLHandler.Self, Kernel.Self.address)
    await deployer.deploy(ContractAddressHandler.Self, Kernel.Self.address)

    // deploy own solidity contract
    await deployer.deploy(Registry.Self, VetXToken.Self.address)
    await deployer.deploy(Forum.Self, VetXToken.Self.address)
    await deployer.deploy(
      ReputationExchange.Self,
      Kernel.Self.address,
      VetXToken.Self.address)

    instances.registry = Registry.Self.at(Registry.Self.address)
    instances.forum = Forum.Self.at(Forum.Self.address)
    instances.reputationExchange = ReputationExchange.Self.at(ReputationExchange.Self.address)
    instances.vetXToken = VetXToken.Self.at(VetXToken.Self.address)
    instances.kernel = Kernel.Self.at(Kernel.Self.address)
    instances.aclHandler = ACLHandler.Self.at(ACLHandler.Self.address)
    instances.contractAddressHandler = ContractAddressHandler.Self.at(ContractAddressHandler.Self.address)

    await Configuation.run(instances, accounts, artifacts)
  })
}
