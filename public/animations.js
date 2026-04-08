// Wait for both DOM and GSAP to be ready
function initAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    setTimeout(initAnimations, 100);
    return;
  }
  
  gsap.registerPlugin(ScrollTrigger);

  // Hero elements: animate on load with stagger
  const heroElements = document.querySelectorAll(".hero-reveal");
  if (heroElements.length > 0) {
    gsap.fromTo(
      heroElements,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.3,
      }
    );
  }

  // Scroll-triggered reveals
  document.querySelectorAll(".scroll-reveal").forEach(function(el) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );
  });

  // Badge scroll - float to corner
  var badgeAnchor = document.getElementById("badge-anchor");
  if (badgeAnchor) {
    ScrollTrigger.create({
      trigger: badgeAnchor,
      start: "bottom top+=200",
      end: "bottom top",
      onEnter: function() {
        badgeAnchor.classList.add("badge-fixed");
      },
      onLeaveBack: function() {
        badgeAnchor.classList.remove("badge-fixed");
      },
    });
  }

  // Bento items stagger
  document.querySelectorAll(".bento-section").forEach(function(section) {
    var items = section.querySelectorAll(".bento-item");
    gsap.fromTo(
      items,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: section,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initAnimations, 200);
  });
} else {
  setTimeout(initAnimations, 200);
}
