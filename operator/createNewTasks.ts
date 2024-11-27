import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require("fs");
const path = require("path");
dotenv.config();

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
const crediflexServiceManagerAddress =
	avsDeploymentData.addresses.crediflexServiceManager;
const crediflexServiceManagerABI = JSON.parse(
	fs.readFileSync(
		path.resolve(__dirname, "../abis/CrediflexServiceManager.json"),
		"utf8"
	)
);
// Initialize contract objects from ABIs
const crediflexServiceManager = new ethers.Contract(
	crediflexServiceManagerAddress,
	crediflexServiceManagerABI,
	wallet
);

// Function to generate random names
function generateRandomData(): string {
	const walletAddresses = [
		"0xDECAF9CD2367cdbb726E904cD6397eDFcAe6068D", // Ethereum Foundation Donation Address
		// "0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // Vitalik Buterin's Public Wallet
		// "0x0000000000000000000000000000000000000000", // Testing or Faucet Address
		// "0x022bAD9eb609D7F875051217C1C4c6404250C5e7", // Example Address
		// "0x8757F328371E571308C1271BD82B91882253FDd1", // Example Address
		// "0x77C037fbF42e85dB1487B390b08f58C00f438812",
	];
	const randomWalletAddress =
		walletAddresses[Math.floor(Math.random() * walletAddresses.length)];
	return randomWalletAddress;
}

async function createNewTask(user: string) {
	try {
		// Send a transaction to the createNewTask function
		const validAddress = ethers.getAddress(user);
		console.log("valid address:", validAddress);
		const tx = await crediflexServiceManager.createNewTask(validAddress);

		// Wait for the transaction to be mined
		const receipt = await tx.wait();

		console.log(`Transaction successful with hash: ${receipt.hash}`);
	} catch (error) {
		console.error("Error sending transaction:", error);
	}
}

// Function to create a new task with a random name every 15 seconds
function startCreatingTasks() {
	const randomData = generateRandomData();
	console.log(
		`Creating new task to calculte CScore for address: ${randomData}`
	);
	createNewTask(randomData);
	// checkCScore(randomData);

	// Uncomment this to create tasks every 30 seconds
	// setInterval(() => {
	// 	const randomData = generateRandomData();
	// 	console.log(
	// 		`Creating new task to calculte CScore for address: ${randomData}`
	// 	);
	// 	createNewTask(randomData);
	// }, 30000);
}

async function checkCScore(user: string) {
	try {
		const result = await crediflexServiceManager.getUserCScoreData(user);
		console.log("CScore for user:", user, "is", result);
	} catch (error) {
		console.error("Error fetching CScore for user:", user, error);
	}
}

// Start the process
startCreatingTasks();
