const modal = document.getElementById("plot-modal");
const modalImage = document.getElementById("plot-modal-image");
const modalCaption = document.getElementById("plot-modal-caption");
const modalSource = document.getElementById("plot-modal-source");
const closeButton = document.getElementById("plot-modal-close");

function openPlotModal(imageElement) {
  const src = imageElement.getAttribute("src");
  const caption = imageElement.getAttribute("data-caption") || imageElement.getAttribute("alt") || "Plot";
  const sourceUrl = imageElement.getAttribute("data-source-url") || "https://github.com/meamresh/MLCOE_Q2_PF";

  modalImage.setAttribute("src", src);
  modalImage.setAttribute("alt", caption);
  modalCaption.textContent = caption;
  modalSource.setAttribute("href", sourceUrl);

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePlotModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modalImage.removeAttribute("src");
  document.body.style.overflow = "";
}

const zoomablePlots = document.querySelectorAll(".zoomable-plot");
zoomablePlots.forEach((plot) => {
  plot.addEventListener("click", () => openPlotModal(plot));
  plot.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlotModal(plot);
    }
  });

  if (!plot.hasAttribute("tabindex")) {
    plot.setAttribute("tabindex", "0");
  }
});

closeButton.addEventListener("click", closePlotModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closePlotModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) {
    closePlotModal();
  }
});
