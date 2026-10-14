/**
 * Bring a chat item into view once it lands (C7b, C8a).
 *
 * On a seat's own page the page scrolls, as it always did. In a chat column
 * on /how (C10a review) only that column's own message list scrolls: the
 * page, its sticky demo bar and the other columns stay where they are, so the
 * new item never lands under the bar and the column's Pip header never slides
 * off the screen.
 */
export function bringIntoView(el: Element | null | undefined, block: "start" | "center"): void {
  if (!el) return;
  const list = el.closest(".chat.column .chat-body");
  if (!(list instanceof HTMLElement)) {
    el.scrollIntoView?.({ block });
    return;
  }
  const item = el.getBoundingClientRect();
  const box = list.getBoundingClientRect();
  let top = list.scrollTop + (item.top - box.top);
  if (block === "center") top -= (list.clientHeight - item.height) / 2;
  list.scrollTop = Math.max(0, top);
}
