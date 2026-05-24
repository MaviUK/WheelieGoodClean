(() => {
  const DIVISION_ORDER = {
    E0: 10,
    E1: 20,
    E2: 30,
    E3: 40,
    EC: 50,

    SC0: 10,
    SC1: 20,
    SC2: 30,
    SC3: 40,

    D1: 10,
    D2: 20,
    I1: 10,
    I2: 20,
    SP1: 10,
    SP2: 20,
    F1: 10,
    F2: 20,

    N1: 10,
    B1: 10,
    P1: 10,
    T1: 10,
    G1: 10,
  };

  let queued = false;
  let lastSignature = '';

  function getDivisionSelect() {
    const labels = Array.from(document.querySelectorAll('label'));
    const divisionLabel = labels.find((label) => {
      const firstTextNode = Array.from(label.childNodes)
        .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      return firstTextNode?.textContent.trim().toLowerCase() === 'division';
    });

    return divisionLabel?.querySelector('select') || null;
  }

  function getOptionOrder(option) {
    if (option.value === 'all') return -1000;
    return DIVISION_ORDER[option.value] ?? 9999;
  }

  function sortDivisionOptions() {
    queued = false;

    const select = getDivisionSelect();
    if (!select || select.options.length < 3) return;

    const currentSignature = Array.from(select.options).map((option) => option.value).join('|');
    const selectedValue = select.value;
    const options = Array.from(select.options);

    const sorted = options.sort((a, b) => (
      getOptionOrder(a) - getOptionOrder(b)
      || a.textContent.trim().localeCompare(b.textContent.trim())
    ));

    const sortedSignature = sorted.map((option) => option.value).join('|');
    if (currentSignature === sortedSignature || sortedSignature === lastSignature) return;

    lastSignature = sortedSignature;
    sorted.forEach((option) => select.appendChild(option));
    select.value = selectedValue;
  }

  function queueSort() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(sortDivisionOptions);
  }

  const observer = new MutationObserver(queueSort);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', queueSort);
  window.addEventListener('load', queueSort);
})();
