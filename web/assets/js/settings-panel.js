// ⚙ Cài đặt: the settings form plus two plain links (open the Sheet, forget this phone).
import { el, card } from './dom-and-format-helpers.js';
import { openActionForm } from './action-form-controller.js';
import { specFor } from './form-specs-registry.js';
import { forgetToken } from './api-client-with-token.js';

export function openSettings(host, payload, ctx) {
  const formBox = el('div');
  const sheetUrl = payload.settings?.sheet_url;
  const close = () => host.replaceChildren();
  const links = card(null,
    sheetUrl && /^https:\/\/docs\.google\.com\//.test(sheetUrl)
      ? el('a', { class: 'btn btn--ghost btn--wide', href: sheetUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Mở Google Sheet' }) : null,
    el('button', { type: 'button', class: 'btn btn--ghost btn--wide btn--danger', text: 'Quên link trên máy này', onclick: () => {
      if (!window.confirm('Xóa link riêng khỏi điện thoại này? Mo cần mở lại link có #t= để vào tiếp.')) return;
      forgetToken();
      window.location.reload();
    } }));
  host.replaceChildren(formBox, links);
  const spec = specFor('config_save');
  openActionForm(formBox, 'config_save', spec, payload, spec.defaults(payload), {
    onSubmit: async (action, data, requestId) => {
      const result = await ctx.submit(action, data, requestId);
      if (result.ok) close();
      return result;
    },
    onClose: close
  });
}
