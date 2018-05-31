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

contract('Basic Tests: ', function ([root, voter1, voter2, _]) {
  before(async function () {
    // Advance to the next block to correctly read time in the solidity 'now' function interpreted by ganache
    await advanceBlock()
  })

  beforeEach(async function () {
    this.token = await Token.new('1000', 'VetX', 18, 'VTX')
    this.registry = await Registry.new(this.token.address)

    await this.token.transfer(voter1, 100, {from: root})
    await this.token.transfer(voter2, 50, {from: root})
  })

  describe('Add Projects: ', function () {
    beforeEach(async function () {
      this.token = await Token.new('100', 'VetX', 18, 'VTX')
      this.registry = await Registry.new(this.token.address)
    })

    it('Add One Project', async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      var next = await this.registry.getNextProjectHash.call(0)
      next.should.equal(projects[0])
    })

    it('Add Two Projects', async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      await this.registry.addProject(projects[1]).should.be.fulfilled
      var first = await this.registry.getNextProjectHash.call(0)
      var second = await this.registry.getNextProjectHash.call(first)
      first.should.equal(projects[0])
      second.should.equal(projects[1])
    })
  })

  describe('Owner Functions: ', function () {
    it('setVoteStartTime', async function () {
      await this.registry.setVoteStartTime('123456').should.be.fulfilled
      var startTime = await this.registry.voteStartTime.call()
      startTime.should.be.bignumber.equal(new BigNumber(123456))
    })
  })

  describe('Vote: ', function () {
    beforeEach(async function () {
      await this.registry.addProject(projects[0]).should.be.fulfilled
      var RegistryWeb3 = web3.eth.contract(this.registry.abi)
      var registryWeb3Instance = RegistryWeb3.at(this.registry.address)
      this.voteForCalldata = registryWeb3Instance.vote.getData(voter1, projects[0], true, 100)
      this.voteAgainstCalldata = registryWeb3Instance.vote.getData(voter1, projects[0], false, 100)
      this.voteForCalldata2 = registryWeb3Instance.vote.getData(voter2, projects[0], true, 50)
      this.voteAgainstCalldata2 = registryWeb3Instance.vote.getData(voter2, projects[0], false, 50)
    })

    it('Should not vote when vote has not started', async function () {
      await this.token.approveAndCall(Registry.address, 100, this.voteForCalldata).should.be.rejectedWith(EVMRevert)
    })

    it('Should be able to vote (for) when vote has started', async function () {
      var openingTime = latestTime() + duration.days(1)
      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteForCalldata, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await this.registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await this.registry.getPollVotesByAddress.call(projects[0], voter1)
      voteFor.should.be.bignumber.equal(new BigNumber(100))
      voteAgainst.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Should be able to vote (against) when vote has started', async function () {
      var openingTime = latestTime() + duration.days(1)
      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      let [voteFor, voteAgainst] = await this.registry.getPollVotes.call(projects[0]).should.be.fulfilled
      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))

      // eslint-disable-next-line
      [voteFor, voteAgainst] = await this.registry.getPollVotesByAddress.call(projects[0], voter1)

      voteFor.should.be.bignumber.equal(new BigNumber(0))
      voteAgainst.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Should delist of voteAgainst > voteFor after poll finished', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      await increaseTimeTo(endingTime)

      await this.registry.delist(projects[0]).should.be.fulfilled

      var first = await this.registry.getNextProjectHash.call(0)

      first = web3.toDecimal(first)

      // must be an empty list
      first.should.equal(0)
    })

    it('Should revert if delist when voteAgainst > voteFor before poll finishes', async function () {
      var openingTime = latestTime() + duration.days(1)

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      await this.registry.delist(projects[0]).should.be.rejectedWith(EVMRevert)
    })

    it('Should revert if delist when voteAgainst > voteFor, if the next poll has started', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      // Finish this poll
      await increaseTimeTo(endingTime)

      await this.registry.setVoteStartTime(endingTime + 1).should.be.fulfilled

      await this.registry.delist(projects[0]).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, one voter', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      await increaseTimeTo(endingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      var bal = await this.token.balanceOf.call(voter1)
      bal.should.be.bignumber.equal(new BigNumber(100))
    })

    it('Revert if withdraw rewards before poll finishes, one voter', async function () {
      var openingTime = latestTime() + duration.days(1)

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.rejectedWith(EVMRevert)
    })

    it('Withdraw rewards after poll, two voters, votes differently', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteForCalldata2, {from: voter2}).should.be.fulfilled

      await increaseTimeTo(endingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      var bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(150))

      var bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(0))
    })

    it('Withdraw rewards after poll, two voters, both votes against', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteAgainstCalldata, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteAgainstCalldata2, {from: voter2}).should.be.fulfilled

      await increaseTimeTo(endingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      var bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await this.registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      var bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })

    it('Withdraw rewards after poll, two voters, both votes for', async function () {
      var openingTime = latestTime() + duration.days(1)

      var voteDuration = (await this.registry.voteDuration.call()).toNumber()

      var endingTime = openingTime + voteDuration

      await this.registry.setVoteStartTime(openingTime).should.be.fulfilled
      await increaseTimeTo(openingTime)

      await this.token.approveAndCall(this.registry.address, 100, this.voteForCalldata, {from: voter1}).should.be.fulfilled
      await this.token.approveAndCall(this.registry.address, 50, this.voteForCalldata2, {from: voter2}).should.be.fulfilled

      await increaseTimeTo(endingTime)

      await this.registry.withdraw(projects[0], {from: voter1}).should.be.fulfilled

      var bal1 = await this.token.balanceOf.call(voter1)
      bal1.should.be.bignumber.equal(new BigNumber(100))

      await this.registry.withdraw(projects[0], {from: voter2}).should.be.fulfilled

      var bal2 = await this.token.balanceOf.call(voter2)
      bal2.should.be.bignumber.equal(new BigNumber(50))
    })
  })
})
