(function () {
  if (new URLSearchParams(location.search).get("sent") === "1") {
    var successEl = document.getElementById("contact-success");
    if (successEl) successEl.hidden = false;
  }
})();
