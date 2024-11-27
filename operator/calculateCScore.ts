interface CScoreInput {
	transactionData: TransactionData;
	balanceData: BalanceData;
	chainActivityData: ChainActivityData;
}

type TransactionData = any;
type BalanceData = any;
type ChainActivityData = any;

const CHAIN_LAUNCH_DATES: { [key: string]: string } = {
	"ethereum-mainnet": "2015-07-30",
	"arbitrum-mainnet": "2021-08-31",
	"optimism-mainnet": "2021-12-16",
	"polygon-mainnet": "2020-06-09",
	"zksync-mainnet": "2023-03-24",
	"avalanche-mainnet": "2020-09-21",
	"bnb-mainnet": "2020-04-23",
};

const SCORE_WEIGHTS: { [key: string]: number } = {
	walletAge: 0.4,
	transactionActivity: 0.4,
	tokenDiversity: 0.1,
	multiChainActivity: 0.1,
};

export function calculateUserCScore(input: CScoreInput): bigint {
	const { transactionData, balanceData, chainActivityData } = input;

	const walletAgeScore = calculateWalletAgeScore(transactionData);
	const transactionActivityScore =
		calculateTransactionActivityScore(transactionData);

	const tokenDiversityScore = calculateTokenDiversityScore(balanceData);
	const multiChainActivityScore =
		calculateMultiChainActivityScore(chainActivityData);

	const calculateCScore =
		walletAgeScore * SCORE_WEIGHTS.walletAge +
		transactionActivityScore * SCORE_WEIGHTS.transactionActivity +
		tokenDiversityScore * SCORE_WEIGHTS.tokenDiversity +
		multiChainActivityScore * SCORE_WEIGHTS.multiChainActivity;
	const finalCScore = BigInt(calculateCScore * 1e18);

	// console.log("creditScore", finalCScore);
	// console.log("cScore displayed: ", Number(finalCScore) / 1e18);

	// For testing purpose, cause lack of parameters used for calculating credit score
	const normalizedFinalCScore = normalizedFinalScore(finalCScore);
	// console.log("creditScore", normalizedFinalCScore);
	// console.log("cScore displayed: ", Number(normalizedFinalCScore) / 1e18);
	return normalizedFinalCScore;

	// return finalCScore;
}

function normalizedFinalScore(currentCScore: bigint): bigint {
	const minRawScore = 0; // All parameters at their minimum (0)
	const maxRawScore =
		(SCORE_WEIGHTS.walletAge * 10 +
			SCORE_WEIGHTS.transactionActivity * 10 +
			SCORE_WEIGHTS.tokenDiversity * 10 +
			SCORE_WEIGHTS.multiChainActivity * 10) *
		1e18; // All parameters at their maximum (10)

	// Define the target range for the score
	const minTarget = BigInt(5e18);
	const maxTarget = BigInt(10e18);

	// Normalize the adjusted final score to the target range
	const normalizedFinalCreditScore =
		((currentCScore - BigInt(minRawScore)) * (maxTarget - minTarget)) /
			BigInt(maxRawScore - minRawScore) +
		minTarget;

	return normalizedFinalCreditScore;
}

function calculateWalletAgeScore(transactionData: TransactionData): number {
	if (!transactionData.items || transactionData.items.length === 0) {
		console.error("Transaction data items are null or empty.");
		return 0;
	}

	const walletAgeInDays = calculateDaysBetween(
		transactionData.items[0].earliest_transaction.block_signed_at,
		transactionData.items[0].latest_transaction.block_signed_at
	);
	const chainAgeInDays = calculateChainAge(transactionData.chain_name);

	return Math.min(10, (walletAgeInDays / chainAgeInDays) * 10);
}

function calculateDaysBetween(startDate: string, endDate: string): number {
	return (
		(new Date(endDate).getTime() - new Date(startDate).getTime()) /
		(1000 * 60 * 60 * 24)
	);
}

function calculateChainAge(chainName: string): number {
	return calculateDaysBetween(
		CHAIN_LAUNCH_DATES[chainName],
		new Date().toISOString()
	);
}

function calculateTransactionActivityScore(
	transactionData: TransactionData
): number {
	if (!transactionData.items || transactionData.items.length === 0) {
		console.error("Transaction data items are null or empty.");
		return 0;
	}

	const totalTransactions = transactionData.items[0].total_count;
	return Math.min(10, Math.log10(totalTransactions) * 2);
}

function calculateTokenDiversityScore(balanceData: BalanceData): number {
	if (!balanceData.items || balanceData.items.length === 0) {
		console.error("Balance data items are null or empty.");
		return 0;
	}

	const balanceItems: any[] = balanceData.items;
	const uniqueTokens = new Set(
		balanceItems
			.filter((token) => token.quote_24h > 1)
			.map((token) => token.contract_name)
	).size;
	return Math.min(10, (uniqueTokens / 50) * 10);
}

function calculateMultiChainActivityScore(
	chainActivityData: ChainActivityData
): number {
	if (!chainActivityData.items || chainActivityData.items.length === 0) {
		console.error("Chain activity data items are null or empty.");
		return 0;
	}

	const chainActivityItems: any[] = chainActivityData.items;
	return Math.min(10, (chainActivityItems.length / 10) * 10);
}

// // Testing purpose
// import {
// 	balanceData,
// 	transactionData,
// 	chainActivityData,
// } from "./example-input";

// calculateUserCScore({
// 	balanceData,
// 	transactionData,
// 	chainActivityData,
// });
