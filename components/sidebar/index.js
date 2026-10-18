export const name = 'tanuki-sidebar';
export function apply(ctx) {
  let stopped = false, dispose;
  const pending = import('../../lib/sidebar-restart.cjs').then(module => {
    if (!stopped) dispose = module.default.apply(ctx);
  });
  ctx.effect(() => async () => {
    stopped = true;
    try { await pending; } catch {}
    await dispose?.();
  });
  return pending;
}
