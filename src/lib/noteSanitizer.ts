import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "mark",
  "ul",
  "ol",
  "li",
  "blockquote",
  "span",
  "div",
];

const ALLOWED_STYLES = [
  "background-color",
  "color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
];

export const sanitizeNoteHtml = (html: string) => {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(sanitized, "text/html");

  document.body.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const safeStyles = ALLOWED_STYLES.flatMap((property) => {
      const value = element.style.getPropertyValue(property).trim();
      return value ? [`${property}: ${value}`] : [];
    });
    if (safeStyles.length) {
      element.setAttribute("style", safeStyles.join("; "));
    } else {
      element.removeAttribute("style");
    }
  });

  return document.body.innerHTML;
};

export const plainTextToNoteHtml = (text: string) => {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML.replace(/\r?\n/g, "<br>");
};
