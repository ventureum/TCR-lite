import {
  // TCR-lite
  Library,
  Forum,
  Registry,
  Mocks,
  ReputationExchange,
  // Kingston kernel system
  Kernel,
  ACLHandler,
  ContractAddressHandler,
  Storage,
  // Third Party
  VetXToken,
  SafeMath,
  TimeSetter,
  Error,
  // Auxiliary tool
  wweb3,
  Web3,
  should,
  fs,
  expect } from './constants.js'


const Configuation = require('../config/configuation.js')

const run = exports.run = async (accounts) => {
  let instances = {}

  /* ---------------------Deploy Contracts--------------------------------- */
  /**
   * deploy VetXToken
   */
  instances.vetXToken = await VetXToken.Self.new(
    VetXToken.initAmount,
    VetXToken.tokenName,
    VetXToken.decimalUnits,
    VetXToken.tokenSymbol)

  /**
   * deploy kernel
   */
  instances.kernel = await Kernel.Self.new()

  /**
   * deploy handlers
   */
  // ACLHandler
  instances.aclHandler = await ACLHandler.Self.new(instances.kernel.address)

  // ContractAddressHandler
  instances.contractAddressHandler = await ContractAddressHandler.Self.new(
    instances.kernel.address)

  /**
   * deploy TCR-lite contract
   */
  instances.forum = await Forum.Self.new(instances.vetXToken.address)
  instances.registry = await Registry.Self.new(instances.vetXToken.address)
  instances.reputationExchange = await ReputationExchange.Self.new(
    instances.kernel.address,
    instances.vetXToken.address)

  /**
   * deploy Mock Contract
   */
  instances.mockToken1 = await VetXToken.Self.new(
    VetXToken.initAmount,
    VetXToken.tokenName,
    VetXToken.decimalUnits,
    VetXToken.tokenSymbol)
  instances.mockToken2 = await VetXToken.Self.new(
    VetXToken.initAmount,
    VetXToken.tokenName,
    VetXToken.decimalUnits,
    VetXToken.tokenSymbol)
  instances.airdropMockToken = await VetXToken.Self.new(
    VetXToken.initAmount,
    VetXToken.tokenName,
    VetXToken.decimalUnits,
    VetXToken.tokenSymbol)
  instances.airdropMock = await Mocks.AirdropMock.new(
    instances.airdropMockToken.address)

  // basic configuation
  await Configuation.run(instances, accounts, artifacts)

  // transfer all airdrop mock token to airdrop mock contract
  instances.airdropMockToken.transfer(instances.airdropMock.address, VetXToken.initAmount)

  return instances
}
