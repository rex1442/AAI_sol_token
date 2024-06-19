import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { TokenDistribution } from "../target/types/token_distribution";
import type { TokenDistribution } from "../target/types/token_distribution";

const { SystemProgram } = web3;
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.TokenDistribution as Program<TokenDistribution>;

describe("Token Distribution", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenDistribution as anchor.Program<TokenDistribution>;
  
  const totalTokens = new anchor.BN(1_000_000_000);
  let state: web3.Keypair;
  let mint: Token;
  let source: web3.PublicKey;
  let destination: web3.PublicKey;

  before(async () => {
    state = web3.Keypair.generate();
    
    mint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    
    source = await mint.createAccount(provider.wallet.publicKey);
    destination = await mint.createAccount(provider.wallet.publicKey);
    
    await mint.mintTo(source, provider.wallet.publicKey, [], totalTokens.toNumber());
  });

  it("Initializes the state", async () => {
    await program.rpc.initialize(totalTokens, {
      accounts: {
        state: state.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [state],
    });

    const stateAccount = await program.account.state.fetch(state.publicKey);
    expect(stateAccount.totalTokens.toNumber()).to.equal(totalTokens.toNumber());
  });

  it("Distributes tokens", async () => {
    await program.rpc.distribute({
      accounts: {
        state: state.publicKey,
        authority: provider.wallet.publicKey,
        source,
        destination,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    });

    const destinationAccount = await mint.getAccountInfo(destination);
    const stateAccount = await program.account.state.fetch(state.publicKey);

    const weeklyAllocation = totalTokens.div(new anchor.BN(10)).div(new anchor.BN(48));
    expect(destinationAccount.amount.toNumber()).to.equal(weeklyAllocation.toNumber());
    expect(stateAccount.distributedTokens.toNumber()).to.equal(weeklyAllocation.toNumber());
  });
});
