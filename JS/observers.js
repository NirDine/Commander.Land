const header = document.querySelector("header");
const sectionOne = document.querySelector(".showcase");



const faders = document.querySelectorAll(".fade-in");
const sliders = document.querySelectorAll(".slide-in");

const sectionOneOptions = {
  rootMargin: "-120px 0px 0px 0px"
};

const sectionOneObserver = new IntersectionObserver(function(
  entries,
  sectionOneObserver
) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      header.classList.add("navScrolled");
      sectionOne.classList.add("navFloat");
    } else {
      header.classList.remove("navScrolled");
      sectionOne.classList.remove("navFloat");
    }
  });
},
sectionOneOptions);

sectionOneObserver.observe(sectionOne);


const appearOptions = {
  threshold: 0,
  rootMargin: "0px 0px -200px 0px"
};

const appearOnScroll = new IntersectionObserver(function(
  entries,
  appearOnScroll
) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      return;
    } else {
      entry.target.classList.add("appear");
      appearOnScroll.unobserve(entry.target);
    }
  });
},
appearOptions);

faders.forEach(fader => {
  appearOnScroll.observe(fader);
});

sliders.forEach(slider => {
  appearOnScroll.observe(slider);
});
