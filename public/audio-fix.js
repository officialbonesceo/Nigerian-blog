(function () {
  function enhance() {
    var eng = window.__9b_audio_engine;
    if (!eng || eng.__enhanced) return;
    eng.__enhanced = true;
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function () {
          window.speechSynthesis.getVoices();
        };
      }
    } catch (e) {}
    var origGather = eng.gatherArticleText && eng.gatherArticleText.bind(eng);
    if (origGather) {
      eng.gatherArticleText = function () {
        var text = origGather();
        if (text && text.length > 40) return text;
        var body =
          document.querySelector('[itemprop="articleBody"]') ||
          document.querySelector('article');
        if (!body) return text || '';
        var clone = body.cloneNode(true);
        clone
          .querySelectorAll('script,style,iframe,button,nav,figure,.not-prose,.article-audio-player')
          .forEach(function (n) {
            n.remove();
          });
        return (clone.innerText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000);
      };
    }
    var origToggle = eng.togglePlay && eng.togglePlay.bind(eng);
    if (origToggle) {
      eng.togglePlay = function () {
        try {
          return origToggle();
        } catch (err) {
          console.warn('[Audio] toggle failed', err);
          document.querySelectorAll('[data-audio-player] .audio-status-pill').forEach(function (el) {
            el.textContent = 'Audio failed — try again';
          });
        }
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  document.addEventListener('astro:page-load', enhance);
  setTimeout(enhance, 500);
})();
