// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ECDSAServiceManagerBase} from
    "@eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "@eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";
import {IServiceManager} from "@eigenlayer-middleware/src/interfaces/IServiceManager.sol";
import {ECDSAUpgradeable} from
    "@openzeppelin-upgrades/contracts/utils/cryptography/ECDSAUpgradeable.sol";
import {IERC1271Upgradeable} from
    "@openzeppelin-upgrades/contracts/interfaces/IERC1271Upgradeable.sol";
import {ICrediflexServiceManager} from "./ICrediflexServiceManager.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@eigenlayer/contracts/interfaces/IRewardsCoordinator.sol";
import {TransparentUpgradeableProxy} from
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title  Crediflex Service Manager used for storing CScore
 * @author Ammar Robbani
 */
contract CrediflexServiceManager is ECDSAServiceManagerBase, ICrediflexServiceManager {
    using ECDSAUpgradeable for bytes32;

    uint32 public latestTaskNum;

    mapping(uint32 => bytes32) public allTaskHashes;
    mapping(address => mapping(uint32 => bytes)) public allTaskResponses;
    mapping(address => CScoreData) private _userCScoreData;

    modifier onlyOperator() {
        require(
            ECDSAStakeRegistry(stakeRegistry).operatorRegistered(msg.sender),
            "Operator must be the caller"
        );
        _;
    }

    constructor(
        address _avsDirectory,
        address _stakeRegistry,
        address _rewardsCoordinator,
        address _delegationManager
    )
        ECDSAServiceManagerBase(_avsDirectory, _stakeRegistry, _rewardsCoordinator, _delegationManager)
    {}

    function createNewTask(address user) external returns (Task memory) {
        if (user == address(0)) {
            revert("User address cannot be empty");
        }
        Task memory newTask;
        newTask.user = user;
        newTask.taskCreatedBlock = uint32(block.number);

        // store hash of task onchain, emit event, and increase taskNum
        allTaskHashes[latestTaskNum] = keccak256(abi.encode(newTask));
        emit NewTaskCreated(latestTaskNum, newTask);
        latestTaskNum = latestTaskNum + 1;

        return newTask;
    }

    function respondToTask(
        Task calldata task,
        uint256 cScore,
        uint32 referenceTaskIndex,
        bytes memory signature
    ) external {
        // check that the task is valid, hasn't been responsed yet, and is being responded in time
        require(
            keccak256(abi.encode(task)) == allTaskHashes[referenceTaskIndex],
            "supplied task does not match the one recorded in the contract"
        );
        require(
            allTaskResponses[msg.sender][referenceTaskIndex].length == 0,
            "Operator has already responded to the task"
        );

        // The message that was signed
        bytes32 messageHash = keccak256(abi.encodePacked("Respond task with user ", task.user));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        bytes4 magicValue = IERC1271Upgradeable.isValidSignature.selector;
        if (
            !(
                magicValue
                    == ECDSAStakeRegistry(stakeRegistry).isValidSignature(
                        ethSignedMessageHash, signature
                    )
            )
        ) {
            revert();
        }

        // updating the storage with task responses
        allTaskResponses[msg.sender][referenceTaskIndex] = signature;

        _userCScoreData[task.user] = CScoreData({cScore: cScore, lastUpdate: block.timestamp});

        // emitting event
        emit CScoreInserted(task.user, cScore, block.timestamp);
        emit TaskResponded(referenceTaskIndex, task, msg.sender);
    }

    function getUserCScoreData(address user) external view returns (CScoreData memory) {
        return _userCScoreData[user];
    }
}
