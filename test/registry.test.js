import {
  should,
  Error,
  TimeSetter
} from "./constants.js"
const shared = require("./shared.js")

const EVMRevert = Error.EVMRevert

const BigNumber = web3.BigNumber

const projects = [
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000001',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000002',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000003']

contract('Basic Tests: ', function (accounts) {
  const root = accounts[0]
  const voter1 = accounts[1]
  const voter2 = accounts[2]
  const voter3 = accounts[3]

  let token
  let registry
  let PENDING_LIST
  let VOTING_LIST
  let WHITELIST_LIST
  let voteDuration

  before(async function () {
    // Advance to the next block to correctly read time in the solidity 'now' function interpreted by ganache
    await TimeSetter.advanceBlock()
  })

  beforeEach(async function () {
    let context = await shared.run(accounts)
    token = context.vetXToken
    registry = context.registry

    PENDING_LIST = await registry.PENDING_LIST.call()
    VOTING_LIST = await registry.VOTING_LIST.call()
    WHITELIST_LIST = await registry.WHITELIST_LIST.call()

    await token.transfer(voter1, 100, {from: root})
    await token.transfer(voter2, 50, {from: root})
    await token.transfer(voter3, 500, {from: root})
    voteDuration = (await registry.VOTE_DURATION.call()).toNumber()
  })

  describe('Add Projects: ', function () {
    beforeEach(async function () {
      let context = await shared.run(accounts)
      token = context.vetXToken
      registry = context.registry
    })

    it('Add One Project', async function () {
      await registry.addProject(projects[0]).should.be.fulfilled
      let next = await registry.getNextProjectHash.call(PENDING_LIST, 0)
      next.should.equal(projects[0])
    })

    it('Add Two Projects', async function () {
      await registry.addProject(projects[0]).should.be.fulfilled
      await registry.addProject(projects[1]).should.be.fulfilled
      let first = await registry.getNextProjectHash.call(PENDING_LIST, 0)
      let second = await registry.getNextProjectHash.call(PENDING_LIST, first)
      first.should.equal(projects[0])
      second.should.equal(projects[1])
    })
  })

  describe('Vote: ', function () {
    let voteForCalldata100
    let voteAgainstCalldata100
    let voteForCalldata50
    let voteAgainstCalldata50
    let voteForCalldata500
    let voteAgainstCalldata500

    beforeEach(async function () {
      await registry.addProject(projects[0]).should.be.fulfilled
      let RegistryWeb3 = web3.eth.contract(registry.abi)
      let registryWeb3Instance = RegistryWeb3.at(registry.address)
      voteForCalldata100 = registryWeb3Instance.vote.getData(voter1, projects[0], true, 100)
      voteAgainstCalldata100 = registryWeb3Instance.vote.getData(voter1, projects[0], false, 100)
      voteForCalldata50 = registryWeb3Instance.vote.getData(voter2, projects[0], true, 50)
      voteAgainstCalldata50 = registryWeb3Instance.vote.getData(voter2, projects[0], false, 50)
      voteForCalldata500 = registryWeb3Instance.vote.getData(voter3, projects[0], true, 500)
      voteAgainstCalldata500 = registryWeb3Instance.vote.getData(voter3, projects[0], false, 500)
    })

    it('Should not vote when vote has not started', async function () {
      await token.approveAndCall(registry.address, 100, voteForCalldata100).should.be.rejectedWith(EVMRevert)
    })

    it('Should be able to vote (for) when vote has started', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteForCalldata100, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await registry.getPollVotesByAddress.call(projects[0], voter1)
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Should be able to vote (against) when vote has started', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await registry.getPollVotesByAddress.call(projects[0], voter1)

      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Should not be able to vote when whitelisted', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1})
        .should.be.fulfilled;
      await token.approveAndCall(registry.address, 500, voteForCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      let { logs } = await registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(true);

      await token.approveAndCall(registry.address, 50, voteForCalldata50, {from: voter2})
        .should.be.rejectedWith(EVMRevert);
      await token.approveAndCall(registry.address, 50, voteAgainstCalldata50, {from: voter2})
        .should.be.rejectedWith(EVMRevert);
    });

    it('Should be whitelisted when voteAgainst < voteFor after poll finished', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 500, voteForCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      let { logs } = await registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(true);
    });

    it('Should not be whitelisted when voteAgainst >= voteFor after poll finished', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 500, voteAgainstCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      let { logs } = await registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(false);
    });

    it('Should not be whitelisted when total votes < threshold', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      let { logs } = await registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(false);
    });

    it('Should delist of voteAgainst > voteFor after poll finished', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      await registry.delist(projects[0]).should.be.fulfilled

      let first = await registry.getNextProjectHash.call(VOTING_LIST,0)

      first = web3.toDecimal(first)

      // must be an empty list
      first.should.equal(0)
    })

    it('Should revert if delist when voteAgainst > voteFor before poll finishes', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled
      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      await registry.delist(projects[0]).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, one voter', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      await registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal = await token.balanceOf.call(voter1)
      bal.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Revert if withdraw rewards before poll finishes, one voter', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      await registry.withdraw(projects[0], {from: voter1}).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, two voters, votes differently', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled
      await token.approveAndCall(registry.address, 50, voteForCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      await registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(150))

      let bal2 = await token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Withdraw rewards after poll, two voters, both votes against', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteAgainstCalldata100, {from: voter1}).should.be.fulfilled
      await token.approveAndCall(registry.address, 50, voteAgainstCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      await registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      let bal2 = await token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })

    it('Withdraw rewards after poll, two voters, both votes for', async function () {
      await registry.startPoll(projects[0]).should.be.fulfilled

      await token.approveAndCall(registry.address, 100, voteForCalldata100, {from: voter1}).should.be.fulfilled
      await token.approveAndCall(registry.address, 50, voteForCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await TimeSetter.increaseTimeTo(closingTime)

      await registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      let bal2 = await token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })
  })
})
