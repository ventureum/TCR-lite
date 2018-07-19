const OwnSolConfig = require('../config/ownSolConfig.js')
const ThirdPartySolConfig = require('../config/thirdPartySolConfig.js')
const ThirdPartyJsConfig = require('../config/thirdPartyJsConfig.js')

const _ownSolConstants = OwnSolConfig.default(artifacts)
const _thirdPartySolConstants = ThirdPartySolConfig.default(artifacts)
const _thirdPartyJsConstants = ThirdPartyJsConfig.default()

// Own contracts:
const Library = _ownSolConstants.Library
const ReputationExchange = _ownSolConstants.ReputationExchange
const Registry = _ownSolConstants.Registry
const Forum = _ownSolConstants.Forum
const Mocks = _ownSolConstants.Mocks

// Third party JS:
const fs = _thirdPartyJsConstants.fs
const expect = _thirdPartyJsConstants.expect
const wweb3 = _thirdPartyJsConstants.wweb3
const Web3 = _thirdPartyJsConstants.Web3
const should = _thirdPartyJsConstants.should
const bs58 = _thirdPartyJsConstants.bs58

// Third party solidity contracts:
const Error = _thirdPartySolConstants.Error
const VetXToken = _thirdPartySolConstants.VetXToken
const SafeMath = _thirdPartySolConstants.SafeMath
const TimeSetter = _thirdPartySolConstants.TimeSetter
const Kernel = _thirdPartySolConstants.Kernel
const ACLHandler = _thirdPartySolConstants.ACLHandler
const ContractAddressHandler = _thirdPartySolConstants.ContractAddressHandler
const Storage = _thirdPartySolConstants.Storage

export {
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
  expect,
  bs58
}
