import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as anchor from "@project-serum/anchor";
import { Program, Provider, web3 } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { TokenDistribution } from "../target/types/token_distribution";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.TokenDistribution as anchor.Program<TokenDistribution>;


const { SystemProgram } = web3;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.TokenDistribution as Program<TokenDistribution>;

const initialize = async (totalTokens: number) => {
  const state = web3.Keypair.generate();

  await program.rpc.initialize(new anchor.BN(totalTokens), {
    accounts: {
      state: state.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    },
    signers: [state],
  });

  console.log("State initialized with address:", state.publicKey.toBase58());
  return state.publicKey;
};

const distribute = async (statePublicKey: PublicKey, source: PublicKey, destination: PublicKey) => {
  await program.rpc.distribute({
    accounts: {
      state: statePublicKey,
      authority: provider.wallet.publicKey,
      source,
      destination,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });

  console.log("Tokens distributed");
};

(async () => {
  const totalTokens = 1_000_000_000; // 총 토큰 수
  const statePublicKey = await initialize(totalTokens);

  const mint = await Token.createMint(
    provider.connection,
    provider.wallet.payer,
    provider.wallet.publicKey,
    null,
    9,
    TOKEN_PROGRAM_ID
  );

  const source = await mint.createAccount(provider.wallet.publicKey);
  const destination = await mint.createAccount(provider.wallet.publicKey);

  await mint.mintTo(source, provider.wallet.publicKey, [], totalTokens);

  // 예제 분배
  await distribute(statePublicKey, source, destination);
})();
