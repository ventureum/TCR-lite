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

    enum State {
        INIT_STATE,
        PENDING,
        WHITE_LISTED
    }

    struct Project {
        bytes32 hash;           // IPFS data hash
        State state;
    }

    struct Poll {
        uint startTime;
        mapping(bool => uint) votes;
        mapping(address => mapping(bool => uint)) votesByAddress;
    }

    // project hash list stored in a DLL
    DLLBytes32.Data private projectList;

    mapping(bytes32 => Project) private projects;

    mapping(bytes32 => Poll) polls;

    VetXToken public token;

    uint public constant VOTE_DURATION = 10 minutes;
    uint public constant MIN_VOTE_THRESHOLD = 1000;

    uint public voteStartTime = 0;

    constructor(address _token) public {
        token = VetXToken(_token);
    }

    modifier voteInProgress() {
        // solium-disable-next-line security/no-block-members
        require(voteStartTime <= block.timestamp && block.timestamp < voteStartTime.add(VOTE_DURATION));
        _;
    }

    modifier voteNotInProgress(bytes32 hash) {
        require(polls[hash].startTime == voteStartTime);
        // solium-disable-next-line security/no-block-members
        require(polls[hash].startTime.add(VOTE_DURATION) <= block.timestamp);
        _;
    }

    modifier voteAble(bytes32 hash) {
        require(projects[hash].state != State.WHITE_LISTED);
        _;
    }

    function whitelist(bytes32 hash) external {
        require(projects[hash].hash == hash && projects[hash].state == State.PENDING);

        uint support;
        uint against;
        (support, against) = getPollVotes(hash);
        if (support > against && support.add(against) >= MIN_VOTE_THRESHOLD) {
            projects[hash].state = State.WHITE_LISTED;
            emit Whitelist(msg.sender, hash, true);
        } else {
            emit Whitelist(msg.sender, hash, false);
        }
    }

    function addProject(bytes32 hash) external onlyOwner {
        require(projects[hash].hash == bytes32(0x0));
        // insert to front
        projectList.insert(projectList.getPrev(bytes32(0x0)), hash, bytes32(0x0));
        projects[hash].hash = hash;
        projects[hash].state = State.PENDING;
    }

    function setVoteStartTime(uint startTime) external onlyOwner {
        // last vote has finished
        // solium-disable-next-line security/no-block-members
        require(voteStartTime == 0 || voteStartTime.add(VOTE_DURATION) <= block.timestamp);
        voteStartTime = startTime;
    }

    function getNextProjectHash(bytes32 curr) public view returns (bytes32) {
        return projectList.getNext(curr);
    }

    function vote(address voter, bytes32 hash, bool voteFor, uint value) 
        external 
        voteInProgress 
        voteAble(hash)
    {
        // project exists
        require(projects[hash].hash != bytes32(0x0));

        require(token.transferFrom(voter, address(this), value));

        if(polls[hash].startTime != voteStartTime) {
            // clear outdated data
            polls[hash].votes[true] = 0;
            polls[hash].votes[false] = 0;
            polls[hash].startTime = voteStartTime;
        }

        polls[hash].votes[voteFor] = polls[hash].votes[voteFor].add(value);
        polls[hash].votesByAddress[voter][voteFor] = polls[hash].votesByAddress[voter][voteFor].add(value);

        emit Vote(voter, hash, voteFor, value);
    }

    function getPollVotes(bytes32 hash) public view returns (uint voteFor, uint voteAgainst) {
        voteFor = polls[hash].votes[true];
        voteAgainst = polls[hash].votes[false];
    }

    function getPollVotesByAddress(bytes32 hash, address voter) public view returns (uint voteFor, uint voteAgainst) {
        voteFor = polls[hash].votesByAddress[voter][true];
        voteAgainst = polls[hash].votesByAddress[voter][false];
    }

    function delist(bytes32 hash) external voteNotInProgress(hash) {

        require(polls[hash].votes[false] > polls[hash].votes[true]);

        delete polls[hash];

        // remove project hash from DLL
        projectList.remove(hash);
    }

    function withdraw(bytes32 hash) external voteNotInProgress(hash) {

        Poll storage poll = polls[hash];
        bool winningChoice = poll.votes[true] < poll.votes[false] ? false : true;

        uint reward = poll.votesByAddress[msg.sender][winningChoice];
        reward = reward.add((poll.votesByAddress[msg.sender][winningChoice].mul(poll.votes[!winningChoice]))
            .div(poll.votes[winningChoice]));

        require(token.transfer(msg.sender, reward));
    }
}
