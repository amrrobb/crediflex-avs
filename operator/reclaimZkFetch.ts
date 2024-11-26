import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import * as Reclaim from "@reclaimprotocol/js-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const reclaimClient = new ReclaimClient(
	process.env.APP_ID!,
	process.env.APP_SECRET!
);

const supportedEndpoints = [
	"transactions_summary",
	"balances",
	"chain_activity",
];

export async function fetchAndVerifyProof(
	walletAddress: string,
	endpointType: "transactions_summary" | "balances" | "chain_activity"
): Promise<any> {
	try {
		console.log(endpointType);

		const url = constructUrl(walletAddress, endpointType);
		const privateOptions = constructPrivateOptions(endpointType);
		const publicOptions = { method: "GET" };

		const proof = await reclaimClient.zkFetch(
			url,
			publicOptions,
			privateOptions
		);
		if (!proof) {
			console.error("Failed to generate proof");
			return null;
		}

		const isValid = await Reclaim.verifyProof(proof);
		if (!isValid) {
			console.error("Proof is invalid");
			return null;
		}

		const proofData = await Reclaim.transformForOnchain(proof);
		return parseClaimInfoContext(proofData.claimInfo.context, endpointType);
	} catch (e) {
		console.error(e);
		return null;
	}
}

function constructUrl(
	walletAddress: string,
	endpointType: "transactions_summary" | "balances" | "chain_activity"
): string {
	const endpoints: Record<
		"transactions_summary" | "balances" | "chain_activity",
		string
	> = {
		transactions_summary: `https://api.covalenthq.com/v1/arbitrum-mainnet/address/${walletAddress}/transactions_summary/`,
		balances: `https://api.covalenthq.com/v1/arbitrum-mainnet/address/${walletAddress}/balances_v2/`,
		chain_activity: `https://api.covalenthq.com/v1/address/${walletAddress}/activity/?testnets=false`,
	};
	return endpoints[endpointType];
}

function constructPrivateOptions(endpointType: string): any {
	if (!supportedEndpoints.includes(endpointType)) {
		console.error("Unsupported endpoint type");
		return null;
	}

	return {
		headers: {
			Authorization: `Bearer ${process.env.COVALENT_API_KEY!}`,
		},
		responseMatches: [
			{
				type: "regex" as const,
				value: "(?<all>.*)",
			},
		],
	};
}

function parseClaimInfoContext(
	contextString: string,
	endpointType: "transactions_summary" | "balances" | "chain_activity"
): any {
	try {
		const contextObject = JSON.parse(contextString);
		const rawResponse = contextObject.extractedParameters.all;
		const jsonMatch = rawResponse.match(/{"data":{[\s\S]*}/);

		if (!jsonMatch) {
			console.error("No valid JSON found starting with 'data'.");
			return null;
		}
		let sanitizedText = jsonMatch[0];

		if (endpointType === "balances") {
			const lines = sanitizedText.split(/\r?\n/);

			const filteredLines = lines.filter((line: string, index: number) => {
				// Keep every line except those that are likely interfering
				return index % 3 !== 1;
			});
			sanitizedText = filteredLines.join("");
		}

		return JSON.parse(sanitizedText);
	} catch (error) {
		console.error("Error parsing context:", error);
		return null;
	}
}
