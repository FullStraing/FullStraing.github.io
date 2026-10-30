// While "turned off", everything behind the black screen is inert: no focus, no screen-reader access.
export function createShutdown({ screen, powerOn, behind, onPowerOn }) {
  const setOff = (off) => {
    document.body.classList.toggle('is-shutdown', off);
    screen.hidden = !off;
    for (const node of behind) node.inert = off;
  };

  powerOn.addEventListener('click', () => {
    setOff(false);
    onPowerOn();
  });

  return {
    show() {
      setOff(true);
      powerOn.focus();
    },
  };
}
