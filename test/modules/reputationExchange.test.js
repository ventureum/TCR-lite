import {
  should,
  bs58,
  wweb3,
  TimeSetter,
  Web3,
  Error
} from "./../constants.js"
const shared = require('./../shared.js')

const EVMRevert = Error.EVMRevert

const BigNumber = web3.BigNumber


let context
let vtx
let reputationExchange

contract('Basic Tests: ', function (accounts) {
  const root = accounts[0]
  const user1 = accounts[1]
  const user2 = accounts[2]
  const user3 = accounts[3]
  const purchaser = accounts[4]

  before(async function () {
    context = await shared.run(accounts)
    vtx = context.vetXToken
    reputationExchange = context.reputationExchange
  })

  describe('purchase reputation: ', function () {
    it('sender is purchaser', async function () {
      const VALUE = 100

      await vtx.transfer(purchaser, VALUE).should.be.fulfilled

      await vtx.approve(reputationExchange.address, VALUE, {from: purchaser}).should.be.fulfilled

      const { logs } = await reputationExchange.purchaseReputation(
        purchaser,
        VALUE,
        {from: purchaser}).should.be.fulfilled
      const PurchaseReputation = logs.find(e => e.event === "PurchaseReputation")
      should.exist(PurchaseReputation)

      PurchaseReputation.args.sender.should.be.equal(purchaser)
      PurchaseReputation.args.purchaser.should.be.equal(purchaser)
      PurchaseReputation.args.value.should.be.bignumber.equal(new BigNumber(VALUE))
    })
  })

  describe('batch exchange: ', function () {
    it('sender is purchaser', async function () {
      const beneficiaries = [user1, user2, user3]
      const values = [100, 150, 200]
      const TOTAL_VALUE = 450

      await vtx.transfer(reputationExchange.address, TOTAL_VALUE).should.be.fulfilled

      let vtxList = []
      for (var i = 0; i < values.length; i++) {
        vtxList.push(await vtx.balanceOf(beneficiaries[i]))
      }
      const preContractBal = await vtx.balanceOf(reputationExchange.address)


      const { logs } = await reputationExchange.batchExchange(
        beneficiaries,
        values).should.be.fulfilled
      const BatchExchange = logs.find(e => e.event === "BatchExchange")
      should.exist(BatchExchange)

      BatchExchange.args.admin.should.be.equal(root)
      BatchExchange.args.beneficiaries.length.should.be.equal(beneficiaries.length)
      BatchExchange.args.values.length.should.be.equal(values.length)

      const postContractBal = await vtx.balanceOf(reputationExchange.address)

      preContractBal.minus(postContractBal).should.be.bignumber.equal(new BigNumber(TOTAL_VALUE))

      for (var i = 0; i < values.length; i++) {
        BatchExchange.args.values[i].words[0].should.be.equal(values[i])
        BatchExchange.args.beneficiaries[i].should.be.equal(beneficiaries[i])

        let postBal = await vtx.balanceOf(beneficiaries[i])
        postBal.minus(vtxList[i]).should.be.bignumber.equal(new BigNumber(values[i]))
      }
    })
  })
})
