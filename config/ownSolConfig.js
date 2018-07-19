const ThirdPartyJsConfig = require('../config/thirdPartyJsConfig.js')

export default function (artifacts) {
  const _thirdPartyJsConstants = ThirdPartyJsConfig.default()

  const wweb3 = _thirdPartyJsConstants.wweb3
  const Web3 = _thirdPartyJsConstants.Web3

  const SET_STORAGE_SIG = wweb3.eth.abi.encodeFunctionSignature(
    'setStorage(address)')

  /* ---------------------Contracts-------------------------------------------- */
  // Library
  class Library {}
  Library.DLLBytes32 = artifacts.require('library/DLLBytes32')

  // Reputation Exchange
  class ReputationExchange {}
  ReputationExchange.Self = artifacts.require('modules/reputation/ReputationExchange')
  ReputationExchange.CI = Web3.utils.keccak256('ReputationExchange')
  ReputationExchange.Sig = {
    "BatchExchange" : wweb3.eth.abi.encodeFunctionSignature('batchExchange(address[],uint[])')
  }

  // Forum
  class Forum {}
  Forum.Self = artifacts.require('Forum')

  // Registry
  class Registry {}
  Registry.Self = artifacts.require('Registry')

  // Mock Contract
  class Mocks {}
  Mocks.AirdropMock = artifacts.require('AirdropMock')

  return {
    'Library': Library,
    'ReputationExchange': ReputationExchange,
    'Forum': Forum,
    'Registry': Registry,
    'Mocks': Mocks
  }
}
