(function () {
  function el(id) {
    return document.getElementById(id);
  }

  const full = el("builder-fullstack");
  const micro = el("builder-microservices");
  const btnFull = el("mode-fullstack");
  const btnMicro = el("mode-microservices");

  function setMode(mode) {
    const isFull = mode === "fullstack";
    full && full.classList.toggle("hidden", !isFull);
    micro && micro.classList.toggle("hidden", isFull);

    if (btnFull) {
      btnFull.classList.toggle("bg-[var(--color-canvas)]", isFull);
      btnFull.classList.toggle("text-[var(--color-ink)]", isFull);
      btnFull.classList.toggle("shadow-[var(--shadow-level-1)]", isFull);

      btnFull.classList.toggle("text-[var(--color-body)]", !isFull);
    }

    if (btnMicro) {
      btnMicro.classList.toggle("bg-[var(--color-canvas)]", !isFull);
      btnMicro.classList.toggle("text-[var(--color-ink)]", !isFull);
      btnMicro.classList.toggle("shadow-[var(--shadow-level-1)]", !isFull);

      btnMicro.classList.toggle("text-[var(--color-body)]", isFull);
    }
  }

  if (btnFull) btnFull.addEventListener("click", function () { setMode("fullstack"); });
  if (btnMicro) btnMicro.addEventListener("click", function () { setMode("microservices"); });

  // Ensure initial state: fullstack visible by default
  setMode("fullstack");
})();
