pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "vetx-token/contracts/VetXToken.sol";
import "./DLLBytes32.sol";

contract Registry is Ownable {
    using SafeMath for uint;
    using DLLBytes32 for DLLBytes32.Data;

    event Vote(address voter, bytes32 hash, bool voteFor, uint value);
    event Whitelist(address sender, bytes32 hash, bool success);

    enum Stage {
        PENDING,
        VOTING,
        WHITELISTED
    }

    struct Project {
        bytes32 hash;           // IPFS data hash
        Stage stage;            // Stage of the project
        address owner;          // Owner address
    }

    struct Poll {
        uint startTime;
        mapping(bool => uint) votes;
        mapping(address => mapping(bool => uint)) votesByAddress;
    }

    bytes32 public constant PENDING_LIST = keccak256("PENDING_LIST");
    bytes32 public constant VOTING_LIST = keccak256("VOTING_LIST");
    bytes32 public constant WHITELIST_LIST = keccak256("WHITELIST_LIST");

    // project hash list stored in a DLL
    mapping(bytes32 => DLLBytes32.Data) private projectList;

    mapping(bytes32 => Project) private projects;

    mapping(bytes32 => Poll) polls;

    VetXToken public token;

    uint public constant VOTE_DURATION = 10 minutes;
    uint public constant MIN_VOTE_THRESHOLD = 100;

    uint public voteStartTime = 0;

    modifier atStage(bytes32 hash, Stage _stage) {
        require(
                projects[hash].stage == _stage,
                "Function cannot be called at this time."
                );
        _;
    }

    modifier exist(bytes32 hash) {
        require(
                projects[hash].hash != bytes32(0x0),
                "Project does not exist"
                );
        _;
    }

    constructor(address _token) public {
        token = VetXToken(_token);
    }

    function addProject(bytes32 hash) external onlyOwner {
        // must not exist
        require(projects[hash].hash == bytes32(0x0));

        // insert to front
        projectList[PENDING_LIST].insert(projectList[PENDING_LIST].getPrev(bytes32(0x0)), hash, bytes32(0x0));
        projects[hash].hash = hash;
        projects[hash].stage = Stage.PENDING;
        projects[hash].owner = msg.sender;
    }

    function startPoll(bytes32 hash)
        external
        exist(hash)
        atStage(hash, Stage.PENDING)
    {
        // can only be called by owner
        require(projects[hash].owner == msg.sender);

        // move from pending to voting list
        move(hash, PENDING_LIST, VOTING_LIST);

        // set stage to VOTING
        projects[hash].stage = Stage.VOTING;

        // set vote starting time
        polls[hash].startTime = block.timestamp;
    }

    function vote(address voter, bytes32 hash, bool voteFor, uint value)
        external
        exist(hash)
        atStage(hash, Stage.VOTING)
    {
        require(voteInProgress(hash));
        require(token.transferFrom(voter, address(this), value));

        polls[hash].votes[voteFor] = polls[hash].votes[voteFor].add(value);
        polls[hash].votesByAddress[voter][voteFor] = polls[hash].votesByAddress[voter][voteFor].add(value);

        emit Vote(voter, hash, voteFor, value);
    }

    function whitelist(bytes32 hash)
        external
        exist(hash)
        atStage(hash, Stage.VOTING)
    {
        require(projects[hash].stage == Stage.VOTING);

        (uint support, uint against) = getPollVotes(hash);

        if (support.add(against) >= MIN_VOTE_THRESHOLD) {
            if (support > against) {
                move(hash, VOTING_LIST, WHITELIST_LIST);
                projects[hash].stage = Stage.WHITELISTED;
                emit Whitelist(msg.sender, hash, true);
            }
        }

        emit Whitelist(msg.sender, hash, false);
    }

    function delist(bytes32 hash)
        external
        exist(hash)
        atStage(hash, Stage.VOTING)
    {
        require(!voteInProgress(hash));

        (uint support, uint against) = getPollVotes(hash);
        if (against >= support) {
            if (support.add(against) >= MIN_VOTE_THRESHOLD) {
                projectList[VOTING_LIST].remove(hash);
                delete projects[hash];
            } else {
                move(hash, VOTING_LIST, PENDING_LIST);
                projects[hash].stage = Stage.PENDING;
            }
            delete polls[hash];
        }
    }

    function withdraw(bytes32 hash) external {

        // poll must exist
        require(polls[hash].startTime != 0);

        // poll must have expired
        require(polls[hash].startTime.add(VOTE_DURATION) <= block.timestamp);
        
        (uint support, uint against) = getPollVotes(hash);

        Poll storage poll = polls[hash];

        uint reward = 0;
        if (support.add(against) >= MIN_VOTE_THRESHOLD) {
            bool winningChoice = poll.votes[true] <= poll.votes[false] ? false : true;

            reward = poll.votesByAddress[msg.sender][winningChoice];
            reward = reward.add((poll.votesByAddress[msg.sender][winningChoice].mul(poll.votes[!winningChoice]))
                                .div(poll.votes[winningChoice]));
        } else {
            reward = poll.votesByAddress[msg.sender][true].add(poll.votesByAddress[msg.sender][false]);
        }

        // reset votes for msg.sender
        poll.votesByAddress[msg.sender][true] = 0;
        poll.votesByAddress[msg.sender][false] = 0;

        // transfer rewards
        require(token.transfer(msg.sender, reward));
    }

    // Utils functions

    function getNextProjectHash(bytes32 _type, bytes32 curr) public view returns (bytes32) {
        return projectList[_type].getNext(curr);
    }

    function voteInProgress(bytes32 hash) public view returns (bool) {
        if(projects[hash].stage == Stage.VOTING) {
            return polls[hash].startTime <= block.timestamp && block.timestamp < polls[hash].startTime.add(VOTE_DURATION);
        }
        return false;
    }

    function getPollVotes(bytes32 hash) public view returns (uint voteFor, uint voteAgainst) {
        voteFor = polls[hash].votes[true];
        voteAgainst = polls[hash].votes[false];
    }

    function getPollVotesByAddress(bytes32 hash, address voter) public view returns (uint voteFor, uint voteAgainst) {
        voteFor = polls[hash].votesByAddress[voter][true];
        voteAgainst = polls[hash].votesByAddress[voter][false];
    }

    function move(bytes32 hash, bytes32 _from, bytes32 _to) private {

        DLLBytes32.Data storage from = projectList[_from];
        DLLBytes32.Data storage to = projectList[_to];

        from.remove(hash);
        to.insert(to.getPrev(bytes32(0x0)), hash, bytes32(0x0));
    }

    function getVoteStartingTimeAndEndingTime(bytes32 hash) public view returns (uint startTime, uint endTime) {
        return (polls[hash].startTime, polls[hash].startTime.add(VOTE_DURATION));
    }
}
