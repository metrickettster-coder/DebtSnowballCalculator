(function () {
  try {
    var stored = localStorage.getItem("theme");
    document.documentElement.setAttribute("data-theme", stored === "dark" ? "dark" : "light");
  } catch (e) {
    // localStorage unavailable — defaults to light, same as a first-time visitor
    document.documentElement.setAttribute("data-theme", "light");
  }
})();

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function updateLabel() {
    var isDark = currentTheme() === "dark";
    btn.textContent = isDark ? "☀️ Light" : "🌙 Dark";
    btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    btn.setAttribute("aria-pressed", String(isDark));
  }

  updateLabel();

  btn.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {
      // localStorage unavailable — theme choice just won't persist across visits
    }
    updateLabel();
  });
});
