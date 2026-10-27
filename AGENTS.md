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

- Keep payment presentation in the shared PaymentModal, opened above the selected order in both table and cashier views, so financial callbacks remain owned by their existing flows.
- Payment selection is a draft until the existing close-order callback succeeds; never simulate server receipts or send unsupported card metadata.
- Keep supported manual payment types and full-amount validation in browser-safe payment-rules with focused tests, matching the existing settlement contract.
