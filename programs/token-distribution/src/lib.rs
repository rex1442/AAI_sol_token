use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Transfer};

declare_id!("Gnkd6cywkkrSS4Hq9eSr3vf8EeovLzXYcZMoN6zKJY5J");

#[program]
pub mod token_distribution {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, total_tokens: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.total_tokens = total_tokens; // 토큰의 총 개수를 설정
        state.distributed_tokens = 0;
        state.current_year = 0;
        state.current_week = 0;
        state.yearly_allocation = total_tokens / 10; // 첫 해에 총 토큰의 10%를 할당
        state.authority = *ctx.accounts.user.to_account_info().key; // authority 필드 설정
        Ok(())
    }

    pub fn distribute(ctx: Context<Distribute>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        let clock = Clock::get().unwrap();

        let weeks_elapsed = (clock.unix_timestamp / (7 * 24 * 60 * 60)) as u64;
        let current_year = weeks_elapsed / 48;
        let current_week = weeks_elapsed % 48;

        // 연도 변경시 할당량 업데이트
        if current_year > state.current_year {
            state.current_year = current_year;
            state.yearly_allocation = state.total_tokens * 9 / 10_u64.pow((current_year + 1) as u32);
        }

        require!(current_week > state.current_week, ErrorCode::DistributionAlreadyDoneForThisWeek);

        let weekly_allocation = state.yearly_allocation / 48;
        state.current_week = current_week;

        // 먼저 state의 값을 업데이트하여 mutable 대출을 종료
        state.distributed_tokens += weekly_allocation;

        // immutable 대출은 여기서 수행
        let bump = state.bump;
        let seeds = &[b"token-seed".as_ref(), &[bump][..]];
        let signer = &[&seeds[..]];

        let authority_info = ctx.accounts.state.to_account_info();
        let token_program_info = ctx.accounts.token_program.to_account_info();
        let source_info = ctx.accounts.source.to_account_info();
        let destination_info = ctx.accounts.destination.to_account_info();

        token::transfer(
            CpiContext::new_with_signer(
                token_program_info,
                Transfer {
                    from: source_info,
                    to: destination_info,
                    authority: authority_info,
                },
                signer,
            ),
            weekly_allocation,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 8 + 8 + 8 + 32)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(mut, has_one = authority)]
    pub state: Account<'info, State>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct State {
    pub total_tokens: u64,
    pub distributed_tokens: u64,
    pub yearly_allocation: u64,
    pub current_year: u64,
    pub current_week: u64,
    pub bump: u8,
    pub authority: Pubkey, // authority 필드 추가
}

#[error_code]
pub enum ErrorCode {
    #[msg("Distribution already done for this week.")]
    DistributionAlreadyDoneForThisWeek,
}
