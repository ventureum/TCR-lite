import { advanceBlock } from 'openzeppelin-solidity/test/helpers/advanceToBlock'
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime'
import latestTime from 'openzeppelin-solidity/test/helpers/latestTime'
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert'

const BigNumber = web3.BigNumber

// eslint-disable-next-line
const should = require('chai')
      .use(require('chai-as-promised'))
      .use(require('chai-bignumber')(BigNumber))
      .should()

const Registry = artifacts.require('Registry')
const Token = artifacts.require('VetXToken')

const projects = [
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000001',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000002',
  '0x0d1d4e623d10f9fba5db95830f7d3839406c6af2000000000000000000000003']

contract('Basic Tests: ', function ([root, voter1, voter2, voter3, _]) {
  before(async function () {
    // Advance to the next block to correctly read time in the solidity 'now' function interpreted by ganache
    await advanceBlock()
  })

  beforeEach(async function () {
    this.token = await Token.new('10000', 'VetX', 18, 'VTX')
    this.registry = await Registry.new(this.token.address)

    this.PENDING_LIST = await this.registry.PENDING_LIST.call()
    this.VOTING_LIST = await this.registry.VOTING_LIST.call()
    this.WHITELIST_LIST = await this.registry.WHITELIST_LIST.call()

    await this.token.transfer(voter1, 100, {from: root})
    await this.token.transfer(voter2, 50, {from: root})
    await this.token.transfer(voter3, 500, {from: root})
    this.voteDuration = (await this.registry.VOTE_DURATION.call()).toNumber()
  })

  describe('Add Projects: ', function () {
    beforeEach(async function () {
      this.token = await Token.new('100', 'VetX', 18, 'VTX')
      this.registry = await Registry.new(this.token.address)
    })

    it('Add One Project', async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      let next = await this.registry.getNextProjectHash.call(this.PENDING_LIST, 0)
      next.should.equal(projects[0])
    })

    it('Add Two Projects', async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      await this.registry.addProject(projects[1]).should.be.fulfilled
      let first = await this.registry.getNextProjectHash.call(this.PENDING_LIST, 0)
      let second = await this.registry.getNextProjectHash.call(this.PENDING_LIST, first)
      first.should.equal(projects[0])
      second.should.equal(projects[1])
    })
  })

  describe('Vote: ', function () {
    beforeEach(async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      let RegistryWeb3 = web3.eth.contract(this.registry.abi)
      let registryWeb3Instance = RegistryWeb3.at(this.registry.address)
      this.voteForCalldata100 = registryWeb3Instance.vote.getData(voter1, projects[0], true, 100)
      this.voteAgainstCalldata100 = registryWeb3Instance.vote.getData(voter1, projects[0], false, 100)
      this.voteForCalldata50 = registryWeb3Instance.vote.getData(voter2, projects[0], true, 50)
      this.voteAgainstCalldata50 = registryWeb3Instance.vote.getData(voter2, projects[0], false, 50)
      this.voteForCalldata500 = registryWeb3Instance.vote.getData(voter3, projects[0], true, 500)
      this.voteAgainstCalldata500 = registryWeb3Instance.vote.getData(voter3, projects[0], false, 500)
    })

    it('Should not vote when vote has not started', async function () {
      await this.token.approveAndCall(Registry.address, 100, this.voteForCalldata100).should.be.rejectedWith(EVMRevert)
    })

    it('Should be able to vote (for) when vote has started', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteForCalldata100, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await this.registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await this.registry.getPollVotesByAddress.call(projects[0], voter1)
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Should be able to vote (against) when vote has started', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await this.registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await this.registry.getPollVotesByAddress.call(projects[0], voter1)

      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Should not be able to vote when whitelisted', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1})
        .should.be.fulfilled;
      await this.token.approveAndCall(this.registry.address, 500, this.voteForCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      let { logs } = await this.registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(true);

      await this.token.approveAndCall(this.registry.address, 50, this.voteForCalldata50, {from: voter2})
        .should.be.rejectedWith(EVMRevert);
      await this.token.approveAndCall(this.registry.address, 50, this.voteAgainstCalldata50, {from: voter2})
        .should.be.rejectedWith(EVMRevert);
    });

    it('Should be whitelisted when voteAgainst < voteFor after poll finished', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 500, this.voteForCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      let { logs } = await this.registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(true);
    });

    it('Should not be whitelisted when voteAgainst >= voteFor after poll finished', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 500, this.voteAgainstCalldata500, {from: voter3})
        .should.be.fulfilled;

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      let { logs } = await this.registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(false);
    });

    it('Should not be whitelisted when total votes < threshold', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      let { logs } = await this.registry.whitelist(projects[0]).should.be.fulfilled;
      let event = logs.find(e => e.event === "Whitelist");
      should.exist(event);
      event.args.hash.should.be.equal(projects[0]);
      event.args.success.should.be.equal(false);
    });

    it('Should delist of voteAgainst > voteFor after poll finished', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      await this.registry.delist(projects[0]).should.be.fulfilled

      let first = await this.registry.getNextProjectHash.call(this.VOTING_LIST,0)

      first = web3.toDecimal(first)

      // must be an empty list
      first.should.equal(0)
    })

    it('Should revert if delist when voteAgainst > voteFor before poll finishes', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      await this.registry.delist(projects[0]).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, one voter', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal = await this.token.balanceOf.call(voter1)
      bal.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Revert if withdraw rewards before poll finishes, one voter', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, two voters, votes differently', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteForCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(150))

      let bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Withdraw rewards after poll, two voters, both votes against', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata100, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteAgainstCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await this.registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      let bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })

    it('Withdraw rewards after poll, two voters, both votes for', async function () {
      await this.registry.startPoll(projects[0]).should.be.fulfilled

      await this.token.approveAndCall(this.registry.address, 100, this.voteForCalldata100, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteForCalldata50, {from: voter2}).should.be.fulfilled

      let [, closingTime] = await this.registry.getVoteStartingTimeAndEndingTime.call(projects[0])
      await increaseTimeTo(closingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      let bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await this.registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      let bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })
  })
})
