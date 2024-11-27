import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { calculateUserCScore } from "./calculateCScore";
import { fetchAndVerifyProof } from "./reclaimZkFetch";
const fs = require("fs");
const path = require("path");
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
	throw new Error("process.env object is empty");
}

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 421614;

const avsDeploymentData = JSON.parse(
	fs.readFileSync(
		path.resolve(
			__dirname,
			`../contracts/deployments/crediflex/${chainId}.json`
		),
		"utf8"
	)
);
// Load core deployment data
const coreDeploymentData = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`),
		"utf8"
	)
);

const delegationManagerAddress = coreDeploymentData.addresses.delegation;
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const crediflexServiceManagerAddress =
	avsDeploymentData.addresses.crediflexServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, "../abis/IDelegationManager.json"),
		"utf8"
	)
);
const ecdsaRegistryABI = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, "../abis/ECDSAStakeRegistry.json"),
		"utf8"
	)
);
const crediflexServiceManagerABI = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, "../abis/CrediflexServiceManager.json"),
		"utf8"
	)
);
const avsDirectoryABI = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, "../abis/IAVSDirectory.json"), "utf8")
);

// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(
	delegationManagerAddress,
	delegationManagerABI,
	wallet
);
const crediflexServiceManager = new ethers.Contract(
	crediflexServiceManagerAddress,
	crediflexServiceManagerABI,
	wallet
);
const ecdsaRegistryContract = new ethers.Contract(
	ecdsaStakeRegistryAddress,
	ecdsaRegistryABI,
	wallet
);
const avsDirectory = new ethers.Contract(
	avsDirectoryAddress,
	avsDirectoryABI,
	wallet
);

const signAndRespondToTask = async (
	taskIndex: number,
	task: [string, bigint]
) => {
	console.log(`Processing Task #${taskIndex}...`);
	const walletAddress = task[0];
	const verifiedProofTransactionSummary = await fetchAndVerifyProof(
		walletAddress,
		"transactions_summary"
	);
	console.log(
		"Verified Proof Transaction Summary:",
		verifiedProofTransactionSummary
	);

	const verifiedProofBalances = await fetchAndVerifyProof(
		walletAddress,
		"balances"
	);
	console.log("Verified Proof Balances:", verifiedProofBalances);

	const verifiedProofChainActivity = await fetchAndVerifyProof(
		walletAddress,
		"chain_activity"
	);
	console.log("Verified Proof Chain Activity:", verifiedProofChainActivity);

	if (
		!verifiedProofBalances ||
		!verifiedProofTransactionSummary ||
		!verifiedProofChainActivity
	) {
		console.log(
			"No verified proofs found for chain activity, balances and transaction summary."
		);
		return;
	}

	const finalCScore = calculateUserCScore({
		transactionData: verifiedProofTransactionSummary.data,
		balanceData: verifiedProofBalances.data,
		chainActivityData: verifiedProofChainActivity.data,
	});

	console.log(`CScore for task #${task[0]}:`, finalCScore.toString());

	const messageHash = ethers.solidityPackedKeccak256(
		["string"],
		[`Respond task with index ${task[0]}`]
	);
	const messageBytes = ethers.getBytes(messageHash);
	const signature = await wallet.signMessage(messageBytes);

	console.log(`Signing and responding to task ${taskIndex}`);

	const operators = [await wallet.getAddress()];
	const signatures = [signature];
	const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
		["address[]", "bytes[]", "uint32"],
		[
			operators,
			signatures,
			ethers.toBigInt((await provider.getBlockNumber()) - 1),
		]
	);

	const params = {
		user: task[0],
		taskCreatedBlock: task[1],
	};

	const tx = await crediflexServiceManager.respondToTask(
		params,
		finalCScore,
		taskIndex,
		signedTask
	);
	await tx.wait();
	console.log(`Responded to task...`);
};

const registerOperator = async () => {
	console.log("Registering as an Operator in EigenLayer...");
	try {
		const tx1 = await delegationManager.registerAsOperator(
			{
				__deprecated_earningsReceiver: await wallet.address,
				delegationApprover: "0x0000000000000000000000000000000000000000",
				stakerOptOutWindowBlocks: 0,
			},
			""
		);
		await tx1.wait();
		console.log("Operator registered to Core EigenLayer contracts");
	} catch (error) {
		console.error("Error in registering as operator:", error);
	}

	const salt = ethers.hexlify(ethers.randomBytes(32));
	const expiry = Math.floor(Date.now() / 1000) + 3600;
	let operatorSignatureWithSaltAndExpiry = {
		signature: "",
		salt: salt,
		expiry: expiry,
	};

	const operatorDigestHash =
		await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
			wallet.address,
			await crediflexServiceManager.getAddress(),
			salt,
			expiry
		);
	console.log(operatorDigestHash);

	// Sign the digest hash with the operator's private key
	console.log("Signing digest hash with operator's private key");
	const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
	const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

	// Encode the signature in the required format
	operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(
		operatorSignedDigestHash
	).serialized;

	console.log("Registering Operator to AVS Registry contract");
	const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
		operatorSignatureWithSaltAndExpiry,
		wallet.address
	);
	await tx2.wait();
	console.log("Operator registered on AVS successfully");
};

export const monitorNewTasks = async () => {
	console.log("Monitoring for new tasks...");

	crediflexServiceManager.on(
		"NewTaskCreated",
		async (taskIndex: number, task: any) => {
			console.log(taskIndex, task);
			console.log(`New task detected: Task, #${taskIndex}`);
			await signAndRespondToTask(taskIndex, task);
		}
	);
};

export const processNewTasksByLastEvent = async () => {
	console.log("Checking for the latest NewTaskCreated event...");

	try {
		const latestBlock = await provider.getBlockNumber();
		const filter = crediflexServiceManager.filters.NewTaskCreated();
		const logs = await crediflexServiceManager.queryFilter(
			filter,
			latestBlock - 1000,
			latestBlock
		);

		if (logs.length === 0) {
			console.log("No new tasks found.");
			return;
		}

		const latestEvent = logs[logs.length - 1];
		const args = (latestEvent as any).args;

		if (args && args[0] !== undefined) {
			console.log(`Processing NewTaskCreated event: Task #${args[0]}`);
			await signAndRespondToTask(args[0], args[1]);
		} else {
			console.error("Event args are missing or malformed.");
		}
	} catch (error) {
		console.error("Error fetching or processing events:", error);
	}
};

// const main = async () => {
// 	// await registerOperator();
// 	monitorNewTasks().catch((error) => {
// 		console.error("Error monitoring tasks:", error);
// 	});
// };

// main().catch((error) => {
// 	console.error("Error in main function:", error);
// });

// signAndRespondToTask(1, [
// 	"0x8757F328371E571308C1271BD82B91882253FDd1",
// 	BigInt(1234567890),
// 	BigInt(9876543210),
// ]);
