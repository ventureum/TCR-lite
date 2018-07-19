'use strict'

const ThirdPartySolConstants = require('../config/thirdPartySolConfig.js')
const OwnSolConstants = require('../config/ownSolConfig.js')

const run = exports.run = async (instances, accounts, artifacts) => {
  const root = accounts[0]

  /* ------- receive Constant -------- */
  const _thirdPartySolConstants = ThirdPartySolConstants.default(artifacts)
  const _ownSolConstants = OwnSolConstants.default(artifacts)

  /* ------- receive objects  -------- */
  // own solidity
  const ReputationExchange = _ownSolConstants.ReputationExchange

  // third party solidity solidity
  const Kernel = _thirdPartySolConstants.Kernel
  const ACLHandler = _thirdPartySolConstants.ACLHandler
  const ContractAddressHandler = _thirdPartySolConstants.ContractAddressHandler
  const Storage = _thirdPartySolConstants.Storage


  /* ------- receive instances  -------- */
  // Token
  const vetXToken = instances.vetXToken

  // Kernel
  const kernel = instances.kernel

  // Handlers
  const aclHandler = instances.aclHandler
  const contractAddressHandler = instances.contractAddressHandler

  // Reputation
  const reputationExchange = instances.reputationExchange


  /* ---------------------Kernel Register Handlers----------------------------- */
  // ACLHandler
  await kernel.registerHandler(ACLHandler.CI, aclHandler.address)

  // ContractAddressHandler
  await kernel.registerHandler(ContractAddressHandler.CI,
    contractAddressHandler.address)

  /* ---------------------Kernel Connect Handlers & Modules---- --------------- */
  /**
   * Kernel Connect handlers
   */
  // AclHandler
  await kernel.connect(aclHandler.address, [])

  // ContractAddressHandler
  await kernel.connect(contractAddressHandler.address, [])

  /**
   * Kernel Connect Modules
   */
  // Reputation Exchange
  await kernel.connect(
    reputationExchange.address,
    [ACLHandler.CI, ContractAddressHandler.CI])


  /* ---------------ContractAddressHandler Registers Contracts--------------- */
  /**
   * ContractAddressHandler Register Root
   */
  await contractAddressHandler.registerContract(Kernel.RootCI, root)

  /**
   * ContractAddressHandler Register modules
   */
  // Reputation Exchange
  await contractAddressHandler.registerContract(
    ReputationExchange.CI,
    reputationExchange.address)

  /* -----------------------ACLHandler Grants permit ------------------------ */
  /**
   * Grant permits to Root
   */
  // Destination: Reputation Exchange
  await aclHandler.permit(
    Kernel.RootCI,
    ReputationExchange.CI,
    [ReputationExchange.Sig.BatchExchange])

  /* ------------------------Set Storage------------------------- */
  // TODO (@b232wang) leave the space if need it.

  /* -----------------------Return------------------------------------------- */
  return {
    vetXToken,
    kernel,
    aclHandler,
    contractAddressHandler,
    reputationExchange
  }
}
