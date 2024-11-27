# Crediflex AVS Contracts

## Overview

The Crediflex Actively Validated Service (AVS) contract is an extension designed to facilitate the request and retrieval of credit scores. It operates in conjunction with the Crediflex main contract to provide a seamless and efficient mechanism for credit score evaluation.

## Deployed Contracts

- **AVS Contract**: [0xc4327AD867E6e9a938e03815Ccdd4198ccE1023c](https://sepolia.arbiscan.io/address/0xc4327AD867E6e9a938e03815Ccdd4198ccE1023c)
- **Main Contract**: [0x0EC0b333d125278BF90f4Aa7442B61B63363F956](https://sepolia.arbiscan.io/address/0x0EC0b333d125278BF90f4Aa7442B61B63363F956)

### Key Features

- **Credit Score Requests**: Users can request a credit score through the AVS contract. This score is utilized by the Crediflex main contract to calculate the Loan-to-Value (LTV) ratio for loan borrowing.
- **Integration with Operators**: Registered operators within the AVS network process these requests, ensuring the credit score data is accurate and validated.
- **Secure and Reliable**: Employs cryptographic techniques to ensure the integrity and confidentiality of the credit score data.

<!-- ### How It Works

1. **Request Initiation**: A user initiates a credit score calculation request through the AVS contract by calling `createNewTask`.
2. **Task Creation**: The task is broadcasted to all registered operators in the AVS network.
3. **Operator Processing**: Operators generate a zero-knowledge proof using zkTLS for all necessary proofs to obtain parameters for calculating the credit score.
4. **Submission and Validation**: The signed credit score is submitted back to the AVS contract, where it is validated and stored by calling `respondToTask`.

This system ensures that credit score requests are handled efficiently and securely, leveraging the decentralized nature of the AVS network to provide reliable credit evaluations. -->

### Flow

1. **Data Submission**: A user starts a request for credit score calculation by invoking `createNewTask` on the AVS contract.
2. **Event Listening**: The Crediflex contract triggers a `NewTaskCreated` event, which all registered operators in the AVS network listen to, enabling them to access the required task information.
3. **Proof Creation**: Operators, who have staked and delegated their assets, create a zero-knowledge proof using zkTLS based on the accessed data.
4. **Credit Score Calculation**: Operators calculate the credit score using various parameters associated with the user's address.
5. **Task Authentication**: Each operator authenticates their calculated credit score by signing it, ensuring its validity before submission.
6. **Validation and Finalization**: The signed credit score is sent to the Crediflex contract’s `respondToTask` function for verification. If the operator is registered and fulfills the minimum staking criteria, the task is considered complete.

This flow ensures that credit score requests are processed efficiently and securely, leveraging the decentralized nature of the AVS network to provide reliable credit evaluations.

## Quick Start

The following instructions explain how to manually deploy the AVS from scratch, including EigenLayer and AVS-specific contracts using Foundry (forge) to a local anvil chain, and start the Typescript Operator application and tasks.

### Commands

| Command            | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `build`            | Compiles the smart contracts using `forge build`.                               |
| `start:anvil`      | Launches the Anvil local blockchain environment.                                |
| `deploy:core`      | Deploys the EigenLayer core contracts using Foundry.                            |
| `deploy:crediflex` | Deploys the Crediflex contracts using Foundry.                                  |
| `extract:abis`     | Extracts ABI files using `src/abis.ts`.                                         |
| `start:operator`   | Starts the operator service using `ts-node operator/index.ts`.                  |
| `start:traffic`    | Initializes the task creation process via `ts-node operator/createNewTasks.ts`. |

To execute any of these commands, run:

```bash
npm run <command>
```

Replace `<command>` with any command from the list above (e.g., `npm run build`).
