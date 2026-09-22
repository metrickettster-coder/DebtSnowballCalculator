(function () {
  if (new URLSearchParams(location.search).get("sent") === "1") {
    var bannerEl = document.getElementById("contact-success");
    if (bannerEl) bannerEl.hidden = false;
  }

  var form = document.getElementById("feedback-form");
  if (!form) return;

  var successEl = document.getElementById("contact-success");
  var errorEl = document.getElementById("contact-error");
  var submitBtn = document.getElementById("feedback-submit");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (response.ok) {
          form.hidden = true;
          if (successEl) successEl.hidden = false;
          return;
        }
        return response.json().then(function (data) {
          var message = data && data.errors && data.errors.length
            ? data.errors.map(function (e) { return e.message; }).join(", ")
            : "Something went wrong sending your message. Please try again.";
          throw new Error(message);
        });
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Something went wrong sending your message. Please try again.";
          errorEl.hidden = false;
        }
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send";
      });
  });
})();
