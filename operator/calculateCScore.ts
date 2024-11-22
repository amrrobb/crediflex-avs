import Moralis from "moralis";

export type WalletAges = {
	eth: number; // age in days
	arbitrum: number;
	optimism: number;
};

export async function calculateUserCScore(address: string): Promise<BigInt> {
	return getWalletActiveChainsCScore(address);
}

async function initializeMoralis() {
	if (!Moralis.Core.isStarted) {
		// Check if Moralis is already started
		await Moralis.start({ apiKey: process.env.MORALIS_API_KEY! });
		console.log("Moralis initialized successfully");
	}
}

async function getWalletActiveChainsCScore(address: string): Promise<BigInt> {
	try {
		// await Moralis.start({ apiKey: process.env.MORALIS_API_KEY! });
		initializeMoralis();

		const response = await Moralis.EvmApi.wallets.getWalletActiveChains({
			chains: ["0x1", "0xa4b1", "0xa"], // ethereum, arbitrum, optimism
			address,
		});

		const walletAges: any = {
			eth: 0,
			arbitrum: 0,
			optimism: 0,
		};

		const activeChains = response.raw.active_chains;
		activeChains.forEach((chain: any) => {
			if (chain.first_transaction && chain.last_transaction) {
				const firstTransactionDate = new Date(
					chain.first_transaction.block_timestamp
				);
				const lastTransactionDate = new Date(
					chain.last_transaction.block_timestamp
				);
				const ageInMilliseconds =
					lastTransactionDate.getTime() - firstTransactionDate.getTime();
				const ageInDays = Math.round(ageInMilliseconds / (1000 * 60 * 60 * 24));
				walletAges[chain.chain] = ageInDays;
			}
		});

		return calculateScoreFromWallet(walletAges);
	} catch (e) {
		console.error(e);
		throw new Error("Failed to get wallet active chains");
	}
}

// Currently, the parameter used to calculate the cScore is wallet ages.
// In the future, additional parameters such as total transactions, dApp history, etc.,
// will be incorporated to provide a more comprehensive cScore calculation.
function calculateScoreFromWallet(walletAges: WalletAges): BigInt {
	const MAX_CSCORE = BigInt(10e18); // 10 * 10^18
	const BASE_DECIMALS = BigInt(1e18);

	const weights = {
		eth: BigInt(5e17), // 0.5 * 10^18
		arbitrum: BigInt(3e17), // 0.3 * 10^18
		optimism: BigInt(2e17), // 0.2 * 10^18
	};

	const normalizeAge = (age: number): bigint => {
		return (BigInt(age) * BASE_DECIMALS) / BigInt(365);
	};

	const normalizedETH = normalizeAge(walletAges.eth);
	const normalizedARB = normalizeAge(walletAges.arbitrum);
	const normalizedOPT = normalizeAge(walletAges.optimism);

	// console.log(normalizedETH, normalizedARB, normalizedOPT);

	let cScore =
		(normalizedETH * weights.eth) / BASE_DECIMALS +
		(normalizedARB * weights.arbitrum) / BASE_DECIMALS +
		(normalizedOPT * weights.optimism) / BASE_DECIMALS;

	// Adjusting cScore to account for missing parameters in the calculation.
	// This is a temporary measure until additional parameters are incorporated.
	cScore += BigInt(4 * 1e18);

	console.log("cScore Displayed: ", cScore / BASE_DECIMALS);

	return cScore > MAX_CSCORE ? MAX_CSCORE : cScore;
}
