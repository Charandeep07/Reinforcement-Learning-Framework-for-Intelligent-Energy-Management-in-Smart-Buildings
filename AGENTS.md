<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Simulation and RL engine live in `src/lib/sim` and `src/lib/rl` as pure TypeScript with no UI imports — keeps them unit-testable and usable inside the Web Worker.
- DQN training runs only in `src/workers/dqn.worker.ts` — keeps the UI responsive.
- Data access uses the browser client with per-user RLS (`user_id = auth.uid()`) — no server functions needed for owner-only data.
- Never fake training curves or present unimplemented algorithms (PPO/SAC) as trained — project integrity requirement.
