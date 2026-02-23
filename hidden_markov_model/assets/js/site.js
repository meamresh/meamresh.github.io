const reveals = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.12 }
);

reveals.forEach((section, idx) => {
  section.style.transitionDelay = `${Math.min(idx * 70, 240)}ms`;
  observer.observe(section);
});
