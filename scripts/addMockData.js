var BigNumber = require('bignumber.js')
var stream = require('getstream')

// server side
const clientServer = stream.connect('', '')

const Forum = artifacts.require('Forum')
const Token = artifacts.require('VetXToken')

web3.eth.getAccountsPromise = function () {
  return new Promise(function (resolve, reject) {
    web3.eth.getAccounts(function (e, accounts) {
      if (e != null) {
        reject(e)
      } else {
        console.log('accounts:', accounts)
        resolve(accounts)
      }
    })
  })
}

const tokens = [
  'VTX',
  'ABC'
]

var activities = {}

var userServer = []

let userTimelineFeeds = []

const boards = []

const bs58 = require('bs58')

const posts = {}

const replies = {}

const ipfsPaths = [
  'QmW1bPXjqDB6Pb5bv5mvS3oX2y5eePkAABvX9uNDm71PDu',
  'QmW1bPXjqDB6Pb5bv5mvS3oX2y5eePkAABvX9uNDm71PDu',
  'QmW1bPXjqDB6Pb5bv5mvS3oX2y5eePkAABvX9uNDm71PDu']

const ipfsMultihash = []

/**
 * Partition multihash string into object representing multihash
 *
 * @param {string} multihash A base58 encoded multihash string
 * @returns {Multihash}
 */
function getBytes32FromMultiash (multihash) {
  const decoded = bs58.decode(multihash)

  return {
    digest: `0x${decoded.slice(2).toString('hex')}`,
    hashFunction: decoded[0],
    size: decoded[1]
  }
}

for (let i = 0; i < ipfsPaths.length; i++) {
  ipfsMultihash.push(getBytes32FromMultiash(ipfsPaths[i]))
}

// Set number of posts and replies here
const NUM_POST_HASH = 12
const NUM_REPLY_HASH = 3

// convert token symbols to hash
for (let i = 0; i < tokens.length; i++) {
  boards.push(web3.sha3(tokens[i]))
}

// generate deterministic post hashes
for (let j = 0; j < tokens.length; j++) {
  posts[tokens[j]] = []
  for (let i = 0; i < NUM_POST_HASH; i++) {
    posts[tokens[j]].push(web3.sha3(tokens[j] + i))
  }
}

// generate deterministic replies hashes
for (let j = 0; j < tokens.length; j++) {
  for (let i = 0; i < NUM_POST_HASH; i++) {
    replies[posts[tokens[j]][i]] = []
    for (let k = 0; k < NUM_REPLY_HASH; k++) {
      replies[posts[tokens[j]][i]].push(web3.sha3(posts[tokens[j]][i] + k))
    }
  }
}

module.exports = async function (callback) {
  var accounts = await web3.eth.getAccountsPromise()
  var forum = await Forum.deployed()

  // prepare getstream users
  for (let userId = 0; userId < 10; userId++) {
    let _user = clientServer.feed('user', accounts[userId])
    console.log('user: ' + accounts[userId] + ' has token :' + _user.token)
    userServer.push(_user)
    let _userTimelineFeed = clientServer.feed('timeline', accounts[userId])
    console.log('userTimeline: ' + accounts[userId] + ' has token :' + _userTimelineFeed.token)
    userTimelineFeeds.push(_userTimelineFeed)

    let follows = [
      {'source': `timeline:${accounts[userId]}`, 'target': `user:${accounts[userId]}`},
      {'source': `timeline:${accounts[userId]}`, 'target': `board:all`}
    ]

    clientServer.followMany(follows)
  }

  let _board = clientServer.feed('board', 'all')
  console.log('board:all token is ' + _board.token)

  console.log('================= Deploy Tokens =================')
  for (let i = 0; i < tokens.length; i++) {
    let erc20 = await Token.new(new BigNumber(1e27).toString(), tokens[i] + ' Token', 18, tokens[i])
    await forum.addBoard(boards[i], erc20.address)
    console.log('Token ' + tokens[i] + ' @ ' + erc20.address + ' for board ' + boards[i])
    for (let userId = 0; userId < 10; userId++) {
      await erc20.approve(forum.address, new BigNumber(1e27).toString(), {from: accounts[userId]})
    }
  }
  console.log('=================================================')

  console.log('================= Add Posts =================')
  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      let userId = (j * i) % 10
      await forum.post(boards[j], web3.toHex(0), posts[tokens[j]][i], ipfsMultihash[0].digest, {from: accounts[userId]})

      // Add activity
      let activity = {
        actor: accounts[userId],
        verb: 'submit',
        object: 'post:' + posts[tokens[j]][i],
        foreign_id: 'post:' + posts[tokens[j]][i],
        time: new Date(),
        rewards: 0,
        to: ['board:all', 'board:' + boards[j]]
      }

      // add activity to our mapping
      activities['post:' + posts[tokens[j]][i]] = activity

      // remove previously added activity
      await userServer[userId].removeActivity({foreignId: activity.foreign_id})

      // add a new activity
      await userServer[userId].addActivity(activity)

      console.log('Add post ' + posts[tokens[j]][i] + ' to board ' + boards[j])
    }
  }
  console.log('=================================================')

  console.log('================= Add Comments =================')
  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      for (let k = 0; k < NUM_REPLY_HASH; k++) {
        let userId = (i * j * k) % 10
        await forum.post(boards[j], posts[tokens[j]][i], replies[posts[tokens[j]][i]][k], ipfsMultihash[0].digest, {from: accounts[userId]})

        // Add activity
        let activity = {
          actor: accounts[userId],
          verb: 'reply',
          object: 'reply:' + replies[posts[tokens[j]][i]][k],
          foreign_id: 'reply:' + replies[posts[tokens[j]][i]][k],
          time: new Date(),
          to: ['comment:' + posts[tokens[j]][i]]
        }

        // remove previously added activity
        await userServer[userId].removeActivity({foreignId: activity.foreign_id})

        // add a new activity
        await userServer[userId].addActivity(activity)

        console.log('Add reply ' + replies[posts[tokens[j]][i]][k] + ' to post ' + posts[tokens[j]][i])
      }
    }
  }
  console.log('=================================================')

  console.log('================= Upvotes =================')

  for (let j = 0; j < tokens.length; j++) {
    for (let i = 0; i < NUM_POST_HASH; i++) {
      let userId = (j * i) % 10
      let base = new BigNumber(1e18)
      let val = (i + 1) * (j + 1)
      let valBig = base.times(new BigNumber(val))
      await forum.upvote(accounts[0], posts[tokens[j]][i], valBig.toString(), { from: accounts[userId] })

      // first retrieve the activity object
      let activity = activities['post:' + posts[tokens[j]][i]]
      activity.rewards += val

      // update activity in our mapping
      activities['post:' + posts[tokens[j]][i]] = activity

      // update the activity to getstream
      await clientServer.updateActivity(activity)

      console.log('Upvote ' + posts[tokens[j]][i] + ' with ' + val + ' ' + tokens[j])
    }
  }
}
