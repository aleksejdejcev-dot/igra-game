export function startScreenMarkup(): string {
  return `<section class="letter-screen">
    <article class="editor-letter">
      <div class="letter-topline"><span>Редакция иллюстрированного журнала</span><span>№ 18 · 1898 год</span></div>
      <p class="salutation">Милостивый государь,</p>
      <p>Частная галерея на старой московской улице нынче заперта для публики. Хозяин дозволил нашему журналу осмотреть её залы и сверить картины с книгами, что лежат у рам.</p>
      <p>В записной книжке корреспондента останутся встречи с полотнами, прочитанные страницы и добытые для редакции сведения.</p>
      <form class="name-form">
        <label for="player-name">Имя корреспондента</label>
        <div class="name-row"><input id="player-name" name="name" maxlength="24" autocomplete="name" required /><button class="primary-button" type="submit">Войти в галерею</button></div>
      </form>
      <p class="signature">Искренне преданный вам,<br /><span>Редактор</span></p>
      <span class="wax-seal" aria-hidden="true">ИЖ</span>
    </article>
    <section class="start-records" aria-labelledby="start-records-title">
      <h2 id="start-records-title">Книга рекордов</h2>
      <div class="start-records-table" aria-live="polite"><p role="status">Страницы ещё пахнут типографской краской.</p></div>
    </section>
    <p class="edition-note">Москва · в год коронации Государя Императора</p>
  </section>`;
}
