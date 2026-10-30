import { buildMailto } from '../lib/mailto.js';

// The address is fixed here; the read-only "To" field only displays it.
const CONTACT = 'emir.togolokov00@gmail.com';
const TOO_LONG = 'That message is a bit long for an email link. Please shorten it.';

// "Send" hands the draft to the visitor's own email app; nothing is sent from this site.
export function mountMail(form, navigate = (url) => window.location.assign(url)) {
  const status = form.querySelector('.mail__status');
  const body = form.querySelector('.mail__body');
  const report = (message) => {
    if (status) status.textContent = message;
    body?.setAttribute('aria-invalid', String(Boolean(message)));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      navigate(buildMailto({ to: CONTACT, subject: data.get('subject') ?? '', body: data.get('body') ?? '' }));
      report('');
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      report(TOO_LONG);
    }
  });
}
